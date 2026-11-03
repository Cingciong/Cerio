"""Finds the fastest settings for this machine. Run it when no training is running (it needs all cores).

    python bot-evo/tune.py            # table: workers x population -> kframes/s, seconds per generation, GPU memory
    python bot-evo/tune.py --apply    # also writes the fastest pop / workers to bot-evo/defaults.json (new runs)
"""

from __future__ import annotations

import argparse
import json
import time

import torch

from evo import net
from evo.evaluate import evaluate
from evo.layout import ROOT
from evo.pool import WorkerPool

LEVELS = [101, 102, 103]  # like a real generation: 3 levels
LENGTH = 120


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--workers", type=int, nargs="*", default=[4, 5, 6])
    ap.add_argument("--pops", type=int, nargs="*", default=[200, 500, 1000, 2000, 4000])
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    gen = torch.Generator(device=device)
    gen.manual_seed(0)
    results = []
    print(f"device {device}; {len(LEVELS)} levels of {LENGTH} tiles per generation\n")
    print("workers   pop   kframes/s   s/generation   GPU MB")
    for workers in args.workers:
        pool = WorkerPool(workers)
        try:
            evaluate(pool, net.init_population(50, device, gen), LEVELS[:1], LENGTH)  # warm-up
            for pop_size in args.pops:
                pop = net.init_population(pop_size, device, gen)
                if device == "cuda":
                    torch.cuda.reset_peak_memory_stats()
                t = time.time()
                ev = evaluate(pool, pop, LEVELS, LENGTH)
                dt = time.time() - t
                frames = sum(r.stats[:, 4].sum() for r in ev.runs)
                mb = torch.cuda.max_memory_allocated() / 2**20 if device == "cuda" else 0
                results.append((frames / dt, workers, pop_size))
                print(f"{workers:7d} {pop_size:5d} {frames / dt / 1000:11.0f} {dt:14.1f} {mb:8.0f}", flush=True)
        finally:
            pool.close()

    fps, workers, pop_size = max(results)
    print(f"\nfastest: {workers} workers, population {pop_size} ({fps / 1000:.0f}k frames/s)")
    if args.apply:
        path = ROOT / "bot-evo" / "defaults.json"
        data = json.loads(path.read_text(encoding="utf8"))
        data["evolution"]["workers"]["value"] = workers
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf8")
        print("workers written to defaults.json (population is your choice: bigger = more diverse but slower generations)")


if __name__ == "__main__":
    main()
