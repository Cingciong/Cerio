"""Score of one episode. Weights come from the "score" section of the run config (bot-evo/defaults.json describes each one).

stats columns (from worker.ts): maxRight px, map width px, coins, won, frames, outcome (0 stall, 1 dead, 2 won).
"""

from __future__ import annotations

import numpy as np

TERMS = {"levelScore": 3000.0, "coin": 1.0, "winBonus": 0.0, "speedBonus": 0.0, "speedFrames": 3600.0, "deathPenalty": 0.0}


def configure(terms: dict) -> None:
    TERMS.update({k: float(v) for k, v in terms.items() if k in TERMS})


def progress(stats: np.ndarray) -> np.ndarray:
    return np.clip(stats[:, 0] / np.maximum(stats[:, 1], 1.0), 0.0, 1.0)


def score(stats: np.ndarray) -> np.ndarray:
    t = TERMS
    won = stats[:, 3]
    died = (stats[:, 5] == 1).astype(np.float64)
    fast = np.clip(1.0 - stats[:, 4] / max(t["speedFrames"], 1.0), 0.0, 1.0) * won
    return (t["levelScore"] * progress(stats) + t["coin"] * stats[:, 2] + t["winBonus"] * won
            + t["speedBonus"] * fast - t["deathPenalty"] * died)
