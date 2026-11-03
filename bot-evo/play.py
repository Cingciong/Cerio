"""Plays one saved genome on one chosen level and writes a replay (same format as the training replays).
Used by the game menu (BOTY tab); runs on the CPU with one worker, so it does not disturb a running training.

    python bot-evo/play.py --run first --genome val --seed 123 --length 120 --out play.json
    python bot-evo/play.py --run first --genome gen --segment smb3_world14-3 --out play.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch

from evo import config, fitness
from evo.evaluate import evaluate, replay_of
from evo.layout import ROOT, Arch
from evo.pool import WorkerPool


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True)
    ap.add_argument("--genome", choices=["val", "gen"], default="val", help="val = best validated, gen = best of the last generation")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--length", type=int, default=120)
    ap.add_argument("--type", default="normal")
    ap.add_argument("--segment", default=None, help="name of a map from levels/<normal|castle|caves>/")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    torch.set_num_threads(1)
    run_dir = ROOT / "bot-evo" / "runs" / args.run
    cfg = config.load(run_dir)
    arch = Arch.from_cfg(cfg["network"])
    fitness.configure(cfg["score"])
    vec = torch.load(run_dir / ("best_val.pt" if args.genome == "val" else "best_gen.pt"), map_location="cpu")[None]

    limits = {"stallDecisions": cfg["evolution"]["stallDecisions"], "maxDecisions": cfg["evolution"]["maxDecisions"]}
    if args.segment:
        limits["segment"] = args.segment
    pool = WorkerPool(1)
    try:
        ev = evaluate(pool, vec, [args.seed], args.length, args.type, limits, arch)
    finally:
        pool.close()

    replay = replay_of(ev, 0, args.length, args.type, {"run": args.run, "gen": -1, "score": float(ev.scores[0])})
    if args.segment:
        replay["levels"][0]["segment"] = args.segment
    Path(args.out).write_text(json.dumps(replay), encoding="utf8")


if __name__ == "__main__":
    main()
