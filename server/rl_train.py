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
    if action_idx == 0: return Buttons.press("right")
    elif action_idx == 1: return Buttons.press("right")
    elif action_idx == 2: return Buttons.press("right", "run")
    elif action_idx == 3: return Buttons.press("right", "jump")
    elif action_idx == 4: return Buttons.press("right", "run", "jump")
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
    episodes = 50000
    pool = WorkerPool(workers=1)
    agent = PlayerRLModel()
    
    agent.epsilon = 1.0
    agent.epsilon_decay = 0.999
    action_repeat = 4 
    
    for ep in range(episodes):
        status, rec = pool.reset(seed=ep, length=4000, level_type="normal", n=1)
        state = extract_state_from_buffer(rec)
        
        total_reward = 0
        done = False
        
        while not status.all():
            if np.random.rand() < agent.epsilon:
                action_idx = np.random.randint(0, 5)
            else:
                with torch.no_grad():
                    state_batch = {k: v.unsqueeze(0) for k, v in state.items()}
                    action_idx = torch.argmax(agent.q_network(state_batch)).item()
            
            buttons = action_to_buttons(action_idx)
            step_reward = 0.0
            
            for _ in range(action_repeat):
                status, next_rec = pool.step(np.array([buttons], dtype=np.uint8))
                done = bool(status[0] != 0) 
                next_state = extract_state_from_buffer(next_rec) if not done else state
                
                vx = next_state['sc'][0].item() 
                
                step_reward += vx * 3.0 
                
                if vx < 0.1:
                    step_reward -= 0.5
                
                if status[0] == 2: 
                    step_reward += 200.0
                elif status[0] == 1:
                    step_reward -= 50.0

                if done: break
            
            agent.memory.append((state, action_idx, step_reward, next_state, done))
            
            if len(agent.memory) >= agent.batch_size:
                agent._train_step()
                
            state = next_state
            total_reward += step_reward

        if agent.epsilon > agent.epsilon_min:
            agent.epsilon *= agent.epsilon_decay
            
        if ep % 50 == 0:
            stats = pool.results()
            max_dist = stats[0, 0]
            print(f"Epoch {ep}/{episodes} | Reward: {total_reward:.1f} | Max Distance: {max_dist:.1f} | Epsilon: {agent.epsilon:.3f}")

    torch.save(agent.q_network.state_dict(), "rl_model_weights.pth")
    print("Saved model to rl_model_weights.pth")
    pool.close()
if __name__ == "__main__":
    train()