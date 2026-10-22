import random
import math
from collections import deque
import torch
import torch.nn as nn
import torch.optim as optim
from frame import GameFrame, ServerReply, EnemyFrame
from game_config import Buttons

class SimpleQNetwork(nn.Module):
    def __init__(self, input_dim, output_dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, output_dim)
        )

    def forward(self, x):
        return self.net(x)

class EnemyRLModel:
    def __init__(self):
        self.q_network = SimpleQNetwork(3, 3)
        self.optimizer = optim.Adam(self.q_network.parameters(), lr=0.005)
        self.criterion = nn.MSELoss()
        
        self.gamma = 0.9
        self.epsilon = 1.0
        self.epsilon_min = 0.1
        self.epsilon_decay = 0.999
        
        self.memory = deque(maxlen=2000)
        self.batch_size = 32
        
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

        # 3. Wybór akcji
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
        self.q_network = SimpleQNetwork(2, 5)
        self.optimizer = optim.Adam(self.q_network.parameters(), lr=0.005)
        self.criterion = nn.MSELoss()
        
        self.gamma = 0.95
        self.epsilon = 1.0
        self.epsilon_min = 0.05
        self.epsilon_decay = 0.999
        
        self.memory = deque(maxlen=2000)
        self.batch_size = 32
        
        self.last_state = None
        self.last_action = None

    def extract_state(self, frame: GameFrame):
        p = frame.player
        v = frame.view
        
        TILE_SIZE = 16.0 
        px_tile = int((p.x + p.w / 2) // TILE_SIZE)
        py_tile = int((p.y + p.h / 2) // TILE_SIZE)
        
        radar_data = []
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                tx = px_tile + dx
                ty = py_tile + dy
                
                rel_x = tx - v.left
                rel_y = ty - v.top
                
                if 0 <= rel_x < v.width and 0 <= rel_y < v.height:
                    is_wall = 1.0 if v.solid(rel_x, rel_y) else 0.0
                    radar_data.append(is_wall)
                else:
                    radar_data.append(1.0)
                    
        enemy_dx, enemy_dy, enemy_vx, enemy_vy = 10.0, 10.0, 0.0, 0.0
        alive_enemies = [e for e in frame.enemies if e.alive]
        
        if alive_enemies:
            nearest = min(alive_enemies, key=lambda e: (e.x - p.x)**2 + (e.y - p.y)**2)
            enemy_dx = (nearest.x - p.x) / 100.0
            enemy_dy = (nearest.y - p.y) / 100.0
            enemy_vx = nearest.vx / 10.0
            enemy_vy = nearest.vy / 10.0
        state_list = radar_data + [p.vx / 10.0, p.vy / 10.0, enemy_dx, enemy_dy, enemy_vx, enemy_vy]
        return torch.tensor(state_list, dtype=torch.float32)

    def get_action(self, player: PlayerFrame, reward: float, done: bool) -> int:
        current_state = self.extract_state(player)

        if self.last_state is not None:
            self.memory.append((
                self.last_state,
                self.last_action,
                reward,
                current_state,
                done
            ))
        
        if len(self.memory) >= self.batch_size:
            batch = random.sample(self.memory, self.batch_size)
            
            states = torch.stack([x[0] for x in batch])
            actions = torch.tensor([x[1] for x in batch])
            rewards = torch.tensor([x[2] for x in batch], dtype=torch.float32)
            next_states = torch.stack([x[3] for x in batch])
            dones = torch.tensor([x[4] for x in batch], dtype=torch.float32)
            
            q_values = self.q_network(states)
            q_value_taken = q_values[range(self.batch_size), actions]
            
            with torch.no_grad():
                max_q_next = torch.max(self.q_network(next_states), dim=1)[0]
            
            target_q = rewards + self.gamma * max_q_next * (1 - dones)
            
            loss = self.criterion(q_value_taken, target_q)
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()

        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

        if random.random() < self.epsilon:
            action_idx = random.randint(0, 4)
        else:
            with torch.no_grad():
                action_idx = torch.argmax(self.q_network(current_state)).item()

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