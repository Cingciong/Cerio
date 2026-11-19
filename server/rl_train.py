import sys
from pathlib import Path
import numpy as np
import torch

CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
BOT_EVO_DIR = ROOT_DIR / "bot-evo"
sys.path.append(str(BOT_EVO_DIR))

from evo.pool import WorkerPool
from rl import PlayerRLModel
from game_config import Buttons

def action_to_buttons(action_idx: int) -> int:
    if action_idx == 0: return 0
    elif action_idx == 1: return Buttons.press("right")
    elif action_idx == 2: return Buttons.press("right", "run")
    elif action_idx == 3: return Buttons.press("right", "jump")
    elif action_idx == 4: return Buttons.press("right", "run", "jump")
    elif action_idx == 5: return Buttons.press("jump")
    return 0

def extract_state_from_buffer(rec, idx=0):
    t = lambda a, dt=torch.float32: torch.from_numpy(a).clone().to(dtype=dt)
    return {
        'tiles': t(rec["tiles"][idx], torch.long),
        'ents': t(rec["ents"][idx], torch.long),
        'etype': t(rec["etype"][idx], torch.long),
        'en': t(rec["en"][idx]),
        'sc': t(rec["sc"][idx])
    }

def train():
    episodes = 80000
    rollout_steps = 256
    action_repeat = 2
    pool = WorkerPool(workers=1)
    agent = PlayerRLModel(
        num_actions=6,
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
    )
    
    recent_rewards = []
    recent_dists = []
    steps_in_rollout = 0

    for ep in range(episodes):
        status, rec = pool.reset(seed=ep % 200, length=120, level_type="normal", n=1)
        state = extract_state_from_buffer(rec)

        total_reward = 0.0
        max_x_reached = 0.0

        while not status.all():
            agent.policy.eval()
            with torch.no_grad():
                state_batch = {k: v.unsqueeze(0) for k, v in state.items()}
                action_idx, log_prob, value = agent.policy.act(state_batch, deterministic=False)

            buttons = action_to_buttons(action_idx)
            step_reward = 0.0
            done = False
            next_state = state

            for _ in range(action_repeat):
                status, next_rec = pool.step(np.array([buttons], dtype=np.uint8))
                done = bool(status[0] != 0)
                if not done:
                    next_state = extract_state_from_buffer(next_rec)

                stats_now = pool.results()
                curr_max_x = float(stats_now[0, 0])
                progress_gain = max(0.0, curr_max_x - max_x_reached)
                max_x_reached = max(max_x_reached, curr_max_x)

                step_reward += progress_gain * 0.5 - 0.01

                if status[0] == 2:
                    step_reward += 100.0
                elif status[0] == 1:
                    step_reward -= 10.0

                if done:
                    break

            agent.add_step(state, action_idx, log_prob, step_reward, done, value)
            steps_in_rollout += 1
            total_reward += step_reward
            state = next_state

            if steps_in_rollout >= rollout_steps:
                last_val = 0.0
                if not done:
                    with torch.no_grad():
                        s_batch = {k: v.unsqueeze(0) for k, v in state.items()}
                        _, last_val_tensor = agent.policy(s_batch)
                        last_val = last_val_tensor.item()
                agent.update(last_value=last_val)
                steps_in_rollout = 0

        stats = pool.results()
        recent_rewards.append(total_reward)
        recent_dists.append(float(stats[0, 0]))

        if ep % 50 == 0 and ep > 0:
            avg_r = sum(recent_rewards[-50:]) / 50.0
            avg_d = sum(recent_dists[-50:]) / 50.0
            print(f"Epoch {ep} | Avg Reward: {avg_r:.1f} | Avg Dist: {avg_d:.1f}")

        if ep > 0 and ep % 500 == 0:
            torch.save(agent.policy.state_dict(), agent.weights_path)

    if steps_in_rollout > 0:
        agent.update(last_value=0.0)

    torch.save(agent.policy.state_dict(), agent.weights_path)
    print(f"Saved model to {agent.weights_path}")
    pool.close()


if __name__ == "__main__":
    train()