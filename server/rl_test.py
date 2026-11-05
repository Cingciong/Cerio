import torch
import numpy as np
import sys
from pathlib import Path
import matplotlib.pyplot as plt
from rl import PlayerRLModel
from rl_train import extract_state_from_buffer, action_to_buttons

CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
BOT_EVO_DIR = ROOT_DIR / "bot-evo"
sys.path.append(str(BOT_EVO_DIR))
from evo.pool import WorkerPool

def evaluate_model(weights_path="rl_model_weights.pth", num_levels=10):
    agent = PlayerRLModel()
    agent.q_network.load_state_dict(torch.load(weights_path))
    agent.q_network.eval()
    agent.epsilon = 0.0
    
    pool = WorkerPool(workers=4) 
    seeds = np.random.randint(0, 10000, size=num_levels).tolist()
    
    action_repeat = 4
    
    print(f"Testing on {num_levels} random levels (seeds: {seeds})...")
    
    wins = 0
    progresses = []
    
    for i, seed in enumerate(seeds):
        status, rec = pool.reset(seed=seed, length=4000, level_type="normal", n=1)
        
        forced_buttons = action_to_buttons(3)
        for _ in range(12):
            status, rec = pool.step(np.array([forced_buttons], dtype=np.uint8))
            if status.all():
                break
        
        while not status.all():
            state = extract_state_from_buffer(rec)
            with torch.no_grad():
                state_batch = {k: v.unsqueeze(0) for k, v in state.items()}
                action_idx = torch.argmax(agent.q_network(state_batch)).item()
                
            buttons = action_to_buttons(action_idx)
            
            for _ in range(action_repeat):
                status, rec = pool.step(np.array([buttons], dtype=np.uint8))
                if status.all():
                    break
            
        stats = pool.results()
        
        max_right = stats[0, 0]
        map_width = max(stats[0, 1], 1.0)
        prog_pct = int(min(100.0, max(0.0, (max_right / map_width) * 100)))
        progresses.append(prog_pct)
        
        won = bool(stats[0, 3])
        wins += 1 if won else 0
        print(f"Level {i+1} (Seed {seed}): {'Won' if won else 'Lost'}")

    winrate = (wins / num_levels) * 100
    print(f"\nWinrate: {winrate}% ({wins}/{num_levels})")
    
    if winrate >= 70:
        print("Reached expected values")
    else:
        print("Didn't reach expected values")
        
    pool.close()

    fig, ax = plt.subplots(figsize=(max(8, num_levels * 0.7), 3))
    data = np.array([progresses])
    cax = ax.imshow(data, cmap="Blues", vmin=0, vmax=100, aspect="auto")
    
    ax.set_xticks(np.arange(num_levels))
    ax.set_xticklabels(seeds, rotation=90)
    ax.set_yticks([0])
    ax.set_yticklabels(["Agent RL"])
    ax.set_title("Postęp na każdej mapie (ziarno poziomu)", loc="left")
    
    for j in range(num_levels):
        val = progresses[j]
        color = "white" if val > 60 else "black"
        ax.text(j, 0, str(val), ha="center", va="center", color=color, fontsize=10)
        
    cbar = fig.colorbar(cax, ax=ax, fraction=0.02, pad=0.02)
    cbar.set_label("postęp %")
    plt.tight_layout()
    plt.savefig("progress_heatmap.png", dpi=150)

if __name__ == "__main__":
    evaluate_model()