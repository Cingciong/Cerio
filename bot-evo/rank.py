"""Ranks every saved bot: the best genome of each run (validated one and last-generation one) plays the same
fixed levels with the default score, so bots from different trainings can be compared directly.
Writes bot-evo/runs/ranking.json. Used by the game menu (BOTY tab); CPU, two workers.

    python bot-evo/rank.py
"""

from __future__ import annotations

import json
import time

import torch

from evo import config, fitness
from evo.evaluate import evaluate
from evo.layout import ROOT, Arch
from evo.pool import WorkerPool

SEEDS = list(range(910_000, 910_010))  # 10 levels no bot trained on
LENGTH = 120


def main() -> None:
    torch.set_num_threads(1)
    defaults = config.defaults()
    fitness.configure(defaults["score"])
    limits = {"stallDecisions": defaults["evolution"]["stallDecisions"], "maxDecisions": defaults["evolution"]["maxDecisions"]}
    rows = []
    pool = WorkerPool(2)
    try:
        for run_dir in sorted((ROOT / "bot-evo" / "runs").iterdir()):
            if not run_dir.is_dir():
                continue
            arch = Arch.from_cfg(config.load(run_dir)["network"])
            mine = []  # the better of the run's two saved bots counts
            for genome, file in (("val", "best_val.pt"), ("gen", "best_gen.pt")):
                if not (run_dir / file).exists():
                    continue
                vec = torch.load(run_dir / file, map_location="cpu")[None]
                if vec.shape[1] != arch.dim:
                    continue
                ev = evaluate(pool, vec, SEEDS, LENGTH, "normal", limits, arch)
                mine.append({"run": run_dir.name, "genome": genome, "score": float(ev.scores[0]), "progress": float(ev.progress[0]),
                             "wins": int(ev.wins[0]), "levels": len(SEEDS)})
            if mine:
                rows.append(max(mine, key=lambda r: r["score"]))
    finally:
        pool.close()
    rows.sort(key=lambda r: -r["score"])
    out = {"time": time.time(), "length": LENGTH, "levels": len(SEEDS), "bots": rows}
    (ROOT / "bot-evo" / "runs" / "ranking.json").write_text(json.dumps(out), encoding="utf8")
    print(f"ranked {len(rows)} bots")


if __name__ == "__main__":
    main()
