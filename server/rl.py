import random
from collections import deque
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from torch.distributions import Categorical
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


class ActorCriticNetwork(nn.Module):
    def __init__(self, num_actions=5):
        super().__init__()

        self.tile_emb = nn.Embedding(num_embeddings=32, embedding_dim=4)
        self.ent_emb = nn.Embedding(num_embeddings=32, embedding_dim=3)

        self.conv1 = nn.Conv2d(in_channels=7, out_channels=8, kernel_size=3, stride=2, padding=1)
        self.conv2 = nn.Conv2d(in_channels=8, out_channels=8, kernel_size=3, stride=2, padding=1)

        self.enemy_linear = nn.Linear(in_features=8, out_features=8)

        fc_input_dim = 256 + 8 + 15

        self.fc1 = nn.Linear(fc_input_dim, 64)
        self.fc2 = nn.Linear(64, 32)
        self.policy_head = nn.Linear(32, num_actions)
        self.value_head = nn.Linear(32, 1)

        self._init_weights()

    def _init_weights(self):
        nn.init.normal_(self.tile_emb.weight, mean=0.0, std=0.2)
        nn.init.normal_(self.ent_emb.weight, mean=0.0, std=0.2)

        for module in [self.conv1, self.conv2, self.enemy_linear, self.fc1, self.fc2]:
            nn.init.kaiming_normal_(module.weight, mode="fan_in", nonlinearity="relu")
            if module.bias is not None:
                nn.init.zeros_(module.bias)

        nn.init.orthogonal_(self.policy_head.weight, gain=0.01)
        nn.init.zeros_(self.policy_head.bias)

        nn.init.orthogonal_(self.value_head.weight, gain=1.0)
        nn.init.zeros_(self.value_head.bias)

    def _encode(self, state_dict):
        tiles = state_dict["tiles"]
        ents = state_dict["ents"]
        etype = state_dict["etype"]
        en = state_dict["en"]
        sc = state_dict["sc"]

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
        return F.relu(self.fc2(x))

    def forward(self, state_dict):
        hidden = self._encode(state_dict)
        logits = self.policy_head(hidden)
        value = self.value_head(hidden).squeeze(-1)
        return logits, value

    def act(self, state_dict, deterministic=False):
        logits, value = self.forward(state_dict)
        if deterministic:
            action = torch.argmax(logits, dim=-1)
            return action.item(), None, value.detach()

        dist = Categorical(logits=logits)
        action = dist.sample()
        log_prob = dist.log_prob(action)
        return action.item(), log_prob.detach(), value.detach()

    def evaluate_actions(self, state_dict, actions):
        logits, values = self.forward(state_dict)
        dist = Categorical(logits=logits)
        log_probs = dist.log_prob(actions)
        entropy = dist.entropy()
        return log_probs, values, entropy

class EnemyRLModel:
    def __init__(self, num_actions=5, weights_path="enemy_q_weights.pth", load_if_exists=False):
        self.num_actions = num_actions
        self.weights_path = weights_path
        self.q_network = EnemyQNetwork(5, num_actions)
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

        if load_if_exists and weights_path and os.path.exists(weights_path):
            self.q_network.load_state_dict(torch.load(weights_path, map_location="cpu"))

    def extract_state(self, enemy: EnemyFrame, player_x: float, player_y: float):
        dx = (player_x - enemy.x) / 100.0
        dy = (player_y - enemy.y) / 100.0
        on_ground = 1.0 if enemy.onGround else 0.0
        return torch.tensor(
            [dx, dy, enemy.vx / 10.0, enemy.vy / 10.0, on_ground],
            dtype=torch.float32,
        )

    def get_action(self, enemy: EnemyFrame, frame: GameFrame, reward: float) -> int:
        enemy_id = enemy.id
        current_state = self.extract_state(enemy, frame.player.x, frame.player.y)

        if enemy_id in self.last_state:
            self.memory.append((
                self.last_state[enemy_id],
                self.last_action[enemy_id],
                reward,
                current_state,
            ))

        if len(self.memory) >= self.batch_size:
            batch = random.sample(self.memory, self.batch_size)
            states = torch.stack([x[0] for x in batch])
            actions = torch.tensor([x[1] for x in batch], dtype=torch.long)
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
            action_idx = random.randint(0, self.num_actions - 1)
        else:
            with torch.no_grad():
                action_idx = torch.argmax(self.q_network(current_state)).item()

        self.last_state[enemy_id] = current_state
        self.last_action[enemy_id] = action_idx

        has_jump = "jump" in Buttons.masks

        if action_idx == 1:
            return Buttons.press("left")
        elif action_idx == 2:
            return Buttons.press("right")
        elif action_idx == 3 and has_jump and enemy.onGround:
            return Buttons.press("jump")
        elif action_idx == 4 and has_jump and enemy.onGround:
            dir_btn = "left" if frame.player.x < enemy.x else "right"
            return Buttons.press(dir_btn, "jump")
        return 0


class PlayerRLModel:
    def __init__(
        self,
        num_actions=5,
        lr=3e-4,
        gamma=0.99,
        gae_lambda=0.95,
        clip_eps=0.2,
        ppo_epochs=4,
        batch_size=64,
        value_coef=0.5,
        entropy_coef=0.02,
        weights_path="ppo_model_weights.pth",
        load_if_exists=False,
    ):
        self.num_actions = num_actions
        self.policy = ActorCriticNetwork(num_actions=num_actions)
        self.optimizer = optim.Adam(self.policy.parameters(), lr=lr)

        self.gamma = gamma
        self.gae_lambda = gae_lambda
        self.clip_eps = clip_eps
        self.ppo_epochs = ppo_epochs
        self.batch_size = batch_size
        self.value_coef = value_coef
        self.entropy_coef = entropy_coef
        self.weights_path = weights_path

        if load_if_exists and weights_path and os.path.exists(weights_path):
            self.policy.load_state_dict(torch.load(weights_path, map_location="cpu"))

        self.clear_rollout()

    def clear_rollout(self):
        self.states = []
        self.actions = []
        self.log_probs = []
        self.rewards = []
        self.dones = []
        self.values = []

    def add_step(self, state, action, log_prob, reward, done, value):
        self.states.append({k: v.detach().cpu() for k, v in state.items()})
        self.actions.append(int(action))
        self.log_probs.append(float(log_prob.item()))
        self.rewards.append(float(reward))
        self.dones.append(bool(done))
        self.values.append(float(value.item()))

    def update(self, last_value=0.0):
        if len(self.rewards) == 0:
            return 0.0

        rewards = self.rewards
        dones = self.dones
        values = self.values + [float(last_value)]

        advantages = [0.0] * len(rewards)
        gae = 0.0
        for t in reversed(range(len(rewards))):
            non_terminal = 0.0 if dones[t] else 1.0
            delta = rewards[t] + self.gamma * values[t + 1] * non_terminal - values[t]
            gae = delta + self.gamma * self.gae_lambda * non_terminal * gae
            advantages[t] = gae

        returns = [advantages[t] + self.values[t] for t in range(len(rewards))]

        states_batch = {
            k: torch.stack([s[k] for s in self.states])
            for k in self.states[0].keys()
        }
        actions_tensor = torch.tensor(self.actions, dtype=torch.long)
        old_log_probs_tensor = torch.tensor(self.log_probs, dtype=torch.float32)
        advantages_tensor = torch.tensor(advantages, dtype=torch.float32)
        returns_tensor = torch.tensor(returns, dtype=torch.float32)

        if advantages_tensor.numel() > 1:
            advantages_tensor = (advantages_tensor - advantages_tensor.mean()) / (
                advantages_tensor.std() + 1e-8
            )

        total_steps = len(self.actions)
        total_loss_val = 0.0
        num_updates = 0

        self.policy.train()
        for _ in range(self.ppo_epochs):
            indices = torch.randperm(total_steps)
            for start in range(0, total_steps, self.batch_size):
                idx = indices[start : start + self.batch_size]
                mb_states = {k: v[idx] for k, v in states_batch.items()}
                mb_actions = actions_tensor[idx]
                mb_old_log_probs = old_log_probs_tensor[idx]
                mb_advantages = advantages_tensor[idx]
                mb_returns = returns_tensor[idx]

                new_log_probs, new_values, entropy = self.policy.evaluate_actions(
                    mb_states, mb_actions
                )

                ratio = torch.exp(new_log_probs - mb_old_log_probs)
                surr1 = ratio * mb_advantages
                surr2 = (
                    torch.clamp(ratio, 1.0 - self.clip_eps, 1.0 + self.clip_eps)
                    * mb_advantages
                )

                policy_loss = -torch.min(surr1, surr2).mean()
                value_loss = F.mse_loss(new_values, mb_returns)
                entropy_loss = -entropy.mean()

                loss = (
                    policy_loss
                    + self.value_coef * value_loss
                    + self.entropy_coef * entropy_loss
                )

                self.optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.policy.parameters(), max_norm=0.5)
                self.optimizer.step()

                total_loss_val += loss.item()
                num_updates += 1

        self.clear_rollout()
        return total_loss_val / max(num_updates, 1)

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