import torch
from frame import GameFrame
from rl import EnemyRLModel


class EnemyServerTrainer:
    def __init__(
        self,
        num_actions: int = 5,
        weights_path: str = "enemy_q_weights.pth",
        load_if_exists: bool = True,
        save_every_frames: int = 600,
    ):
        self.enemy_model = EnemyRLModel(
            num_actions=num_actions,
            weights_path=weights_path,
            load_if_exists=load_if_exists,
        )
        self.weights_path = weights_path
        self.save_every_frames = save_every_frames
        self.prev_enemy_x: dict[int, float] = {}
        self.prev_alive_ids: set[int] = set()
        self.steps_seen = 0

    def step(self, frame: GameFrame) -> dict[int, int]:
        enemy_buttons: dict[int, int] = {}
        current_alive_ids = {e.id for e in frame.enemies if e.alive}

        for dead_id in self.prev_alive_ids - current_alive_ids:
            if dead_id in self.enemy_model.last_state:
                self.enemy_model.memory.append((
                    self.enemy_model.last_state[dead_id],
                    self.enemy_model.last_action[dead_id],
                    -10.0,
                    self.enemy_model.last_state[dead_id],
                ))

        for enemy in frame.enemies:
            if not enemy.alive:
                continue

            eid = enemy.id
            reward = -0.02

            if eid in self.prev_enemy_x:
                dist_prev = abs(self.prev_enemy_x[eid] - frame.player.x)
                dist_now = abs(enemy.x - frame.player.x)
                if dist_now < dist_prev:
                    reward += 0.15
                elif dist_now > dist_prev:
                    reward -= 0.1

                if abs(enemy.x - self.prev_enemy_x[eid]) < 0.1:
                    reward -= 0.3

            if frame.status == "dead":
                dist_to_player = (
                    (frame.player.x - enemy.x) ** 2 + (frame.player.y - enemy.y) ** 2
                ) ** 0.5
                if dist_to_player < 80.0:
                    reward += 25.0

            self.prev_enemy_x[eid] = enemy.x
            enemy_buttons[eid] = self.enemy_model.get_action(enemy, frame, reward)

        self.prev_alive_ids = current_alive_ids
        self.steps_seen += 1

        if frame.status in ("dead", "won"):
            self.prev_enemy_x.clear()
            self.prev_alive_ids.clear()

        if self.save_every_frames > 0 and self.steps_seen % self.save_every_frames == 0:
            torch.save(self.enemy_model.q_network.state_dict(), self.weights_path)

        return enemy_buttons

    def save(self) -> None:
        torch.save(self.enemy_model.q_network.state_dict(), self.weights_path)