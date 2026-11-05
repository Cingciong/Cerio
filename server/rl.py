import random
from collections import deque
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from frame import GameFrame, ServerReply, EnemyFrame
from game_config import Buttons
import os

class EnemyQNetwork(nn.Module):
    def __init__(self, input_dim, output_dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, output_dim)
        )

    def forward(self, x):
        return self.net(x)


class SimpleQNetwork(nn.Module):
    def __init__(self, num_actions=5):
        super().__init__()
        
        self.tile_emb = nn.Embedding(num_embeddings=32, embedding_dim=4)
        self.ent_emb = nn.Embedding(num_embeddings=32, embedding_dim=3)
        
        self.conv1 = nn.Conv2d(in_channels=7, out_channels=8, kernel_size=3, stride=2, padding=1)
        self.conv2 = nn.Conv2d(in_channels=8, out_channels=8, kernel_size=3, stride=2, padding=1)
        
        self.enemy_linear = nn.Linear(in_features=8, out_features=8)
        
        fc_input_dim = 256 + 8 + 15
        
        self.fc1 = nn.Linear(fc_input_dim, 32)
        self.fc2 = nn.Linear(32, 16)
        self.fc_out = nn.Linear(16, num_actions)

    def forward(self, state_dict):
        tiles = state_dict['tiles']
        ents = state_dict['ents']
        etype = state_dict['etype']
        en = state_dict['en']
        sc = state_dict['sc']

        t_emb = self.tile_emb(tiles)
        e_emb = self.ent_emb(ents)
        
        view = torch.cat([t_emb, e_emb], dim=-1).permute(0, 3, 1, 2)
        
        c1 = F.relu(self.conv1(view))
        c2 = F.relu(self.conv2(c1))
        flat_view = c2.flatten(start_dim=1)

        etype_emb = self.ent_emb(etype)
        enemy_feat = torch.cat([en, etype_emb], dim=-1)
        enemy_hidden = F.relu(self.enemy_linear(enemy_feat))
        
        mask = (etype > 0).unsqueeze(-1).float()
        enemies_pooled = (enemy_hidden * mask).amax(dim=1)

        x = torch.cat([flat_view, enemies_pooled, sc], dim=1)
        
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        return self.fc_out(x)

class EnemyRLModel:
    def __init__(self):
        self.q_network = EnemyQNetwork(3, 3)
        self.optimizer = optim.Adam(self.q_network.parameters(), lr=0.005)
        self.criterion = nn.MSELoss()
        
        self.gamma = 0.99
        self.epsilon = 1.0
        self.epsilon_min = 0.1
        self.epsilon_decay = 0.999
        
        self.memory = deque(maxlen=20000)
        self.batch_size = 64
        
        self.last_state = {}
        self.last_action = {}

    def extract_state(self, enemy: EnemyFrame, player_x: float, player_y: float):
        dx = (player_x - enemy.x) / 100.0
        dy = (player_y - enemy.y) / 100.0
        return torch.tensor([dx, dy, enemy.vx / 10.0], dtype=torch.float32)

    def get_action(self, enemy: EnemyFrame, frame: GameFrame, reward: float) -> int:
        enemy_id = enemy.id
        current_state = self.extract_state(enemy, frame.player.x, frame.player.y)

        if enemy_id in self.last_state:
            self.memory.append((
                self.last_state[enemy_id],
                self.last_action[enemy_id],
                reward,
                current_state
            ))
        
        if len(self.memory) >= self.batch_size:
            batch = random.sample(self.memory, self.batch_size)
            states = torch.stack([x[0] for x in batch])
            actions = torch.tensor([x[1] for x in batch])
            rewards = torch.tensor([x[2] for x in batch], dtype=torch.float32)
            next_states = torch.stack([x[3] for x in batch])
            
            q_values = self.q_network(states)
            q_value_taken = q_values[range(self.batch_size), actions]
            
            with torch.no_grad():
                max_q_next = torch.max(self.q_network(next_states), dim=1)[0]
            target_q = rewards + self.gamma * max_q_next
            
            loss = self.criterion(q_value_taken, target_q)
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()

        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

        if random.random() < self.epsilon:
            action_idx = random.randint(0, 2)
        else:
            with torch.no_grad():
                action_idx = torch.argmax(self.q_network(current_state)).item()

        self.last_state[enemy_id] = current_state
        self.last_action[enemy_id] = action_idx

        if action_idx == 1: return Buttons.press("left")
        elif action_idx == 2: return Buttons.press("right")
        return 0


class PlayerRLModel:
    def __init__(self):
        self.q_network = SimpleQNetwork(num_actions=5)

        self.target_network = SimpleQNetwork(num_actions=5)
        self.target_network.load_state_dict(self.q_network.state_dict())
        self.target_network.eval()
        self.target_update_freq = 1000
        self.steps_done = 0

        self.optimizer = optim.Adam(self.q_network.parameters(), lr=0.0005)
        self.criterion = nn.SmoothL1Loss()
        
        self.gamma = 0.95
        self.epsilon = 1.0
        self.epsilon_min = 0.05
        self.epsilon_decay = 0.999
        
        self.memory = deque(maxlen=2000)
        self.batch_size = 32
        
        self.last_state = None
        self.last_action = None
        
        if os.path.exists("rl_model_weights.pth"):
            self.q_network.load_state_dict(torch.load("rl_model_weights.pth"))
            self.q_network.eval()
            self.epsilon = 0.05

    def extract_state(self, frame: GameFrame):
        W, H, BEHIND = 32, 15, 8
        TILE = 16.0 
        
        tiles = torch.zeros((H, W), dtype=torch.long)
        ents = torch.zeros((H, W), dtype=torch.long)
        etype = torch.zeros(16, dtype=torch.long)
        en = torch.zeros((16, 5), dtype=torch.float32)
        sc = torch.zeros(15, dtype=torch.float32)

        p = frame.player
        cx = p.x + p.w / 2.0
        cy = p.y + p.h / 2.0
        left_tile = int(cx // TILE) - BEHIND

        for ty in range(H):
            for tx in range(W):
                world_tx = left_tile + tx
                rel_x = world_tx - frame.view.left
                rel_y = ty - frame.view.top
                
                if 0 <= rel_x < frame.view.width and 0 <= rel_y < frame.view.height:
                    tiles[ty, tx] = 1 if frame.view.solid(rel_x, rel_y) else 0

        def put_entity(ex, ey, ew, eh, e_id):
            ecx = ex + ew / 2.0
            ecy = ey + eh / 2.0
            gx = int(ecx // TILE) - left_tile
            gy = int(ecy // TILE)
            
            if gx < 0 or gx >= W:
                return False, ecx, ecy
            if 0 <= gy < H:
                ents[gy, gx] = e_id
            return True, ecx, ecy

        slot = 0
        alive_enemies = [e for e in frame.enemies if e.alive]
        for e in alive_enemies:
            e_id = (sum(ord(c) for c in e.type) % 31) + 1 
            
            put_success, ecx, ecy = put_entity(e.x, e.y, e.w, e.h, e_id)
            if not put_success or slot >= 16:
                continue 
                
            etype[slot] = e_id
            en[slot, 0] = (ecx - cx) / TILE / 16.0
            en[slot, 1] = (ecy - cy) / TILE / 8.0
            en[slot, 2] = e.vx / 4.0 
            en[slot, 3] = e.vy / 4.0
            en[slot, 4] = 0.0 
            
            slot += 1

        def frac(val):
            return ((val % TILE) + TILE) % TILE / TILE

        sc[0] = p.vx / 4.0  
        sc[1] = p.vy / 4.0
        sc[2] = 1.0 if p.onGround else 0.0
        sc[3] = frac(cx)
        sc[4] = frac(cy)
        sc[5] = 1.0 

        return {
            'tiles': tiles,
            'ents': ents,
            'etype': etype,
            'en': en,
            'sc': sc
        }

    def _train_step(self):
        batch = random.sample(self.memory, self.batch_size)
        
        states = {k: torch.stack([x[0][k] for x in batch]) for k in batch[0][0].keys()}
        next_states = {k: torch.stack([x[3][k] for x in batch]) for k in batch[0][3].keys()}
        
        actions = torch.tensor([x[1] for x in batch], dtype=torch.long)
        rewards = torch.tensor([x[2] for x in batch], dtype=torch.float32)
        dones = torch.tensor([x[4] for x in batch], dtype=torch.float32)
        
        q_values = self.q_network(states)
        q_value_taken = q_values[range(self.batch_size), actions]
        
        with torch.no_grad():
            max_q_next = torch.max(self.target_network(next_states), dim=1)[0]
        
        target_q = rewards + self.gamma * max_q_next * (1 - dones)
        
        loss = self.criterion(q_value_taken, target_q)
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.q_network.parameters(), max_norm=1.0)
        self.optimizer.step()
        
        self.steps_done += 1
        if self.steps_done % self.target_update_freq == 0:
            self.target_network.load_state_dict(self.q_network.state_dict())

    def get_action(self, frame: GameFrame, reward: float, done: bool) -> int:
        current_state = self.extract_state(frame)

        if self.last_state is not None:
            self.memory.append((
                self.last_state,
                self.last_action,
                reward,
                current_state,
                done
            ))
        
        if len(self.memory) >= self.batch_size:
            self._train_step()

        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

        if random.random() < self.epsilon:
            action_idx = random.randint(0, 4)
        else:
            with torch.no_grad():
                state_batch = {k: v.unsqueeze(0) for k, v in current_state.items()}
                action_idx = torch.argmax(self.q_network(state_batch)).item()

        if done:
            self.last_state = None
            self.last_action = None
        else:
            self.last_state = current_state
            self.last_action = action_idx
        
        if action_idx == 1: return Buttons.press("right")
        elif action_idx == 2: return Buttons.press("right", "run")
        elif action_idx == 3: return Buttons.press("right", "jump")
        elif action_idx == 4: return Buttons.press("right", "run", "jump")
        return 0

class RLTrainer:
    def __init__(self):
        self.player_model = PlayerRLModel()
        self.enemy_model = EnemyRLModel()
        self.prev_enemy_x = {}
        self.prev_player_x = 0.0

    def decide(self, frame: GameFrame) -> ServerReply:
        done = frame.status in ["dead", "won"]
        
        player_reward = 0.0
        
        if frame.status == "dead":
            player_reward = -50.0
        elif frame.frame > 0:
            movement = frame.player.x - self.prev_player_x
            if movement > 0.1:
                player_reward = movement * 0.1
            elif movement < -0.1:
                player_reward = -0.5
            else:
                player_reward = -0.1

        self.prev_player_x = frame.player.x
        player_buttons = self.player_model.get_action(frame, player_reward, done)

        enemy_buttons = {}
        for enemy in frame.enemies:
            if not enemy.alive:
                continue
                
            enemy_id = enemy.id
            reward = 0.0
            
            if enemy_id in self.prev_enemy_x:
                dist_prev = abs(self.prev_enemy_x[enemy_id] - frame.player.x)
                dist_now = abs(enemy.x - frame.player.x)
                
                if dist_now < dist_prev:
                    reward = 0.1
                elif dist_now > dist_prev:
                    reward = -0.1

                movement = abs(enemy.x - self.prev_enemy_x[enemy_id])
                if movement < 0.1:
                    reward = -0.5 
            
            self.prev_enemy_x[enemy_id] = enemy.x
            enemy_buttons[enemy_id] = self.enemy_model.get_action(enemy, frame, reward)

        if done:
            self.prev_enemy_x.clear()
            self.prev_player_x = 0.0

        return ServerReply(
            frame=frame.frame,
            player=player_buttons,
            enemies=enemy_buttons
        )