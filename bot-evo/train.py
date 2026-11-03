"""bot-evo: neuroevolution of a Mario bot. The network lives here (PyTorch, GPU), the game runs in Node workers.

    python bot-evo/train.py --run first                       # new run (settings: bot-evo/defaults.json)
    python bot-evo/train.py --run first --set pop=100 gens=50  # override settings
    python bot-evo/train.py --run first --resume              # continue
    tensorboard --logdir bot-evo/runs

The game menu (npm run dev -> "Bot-evo") starts, stops and edits runs too.
Settings are read again every generation (runs/<run>/config.json), except the ones with "hot": false.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
from torch.utils.tensorboard import SummaryWriter

from evo import config, fitness, net, viz
from evo.algorithm import GA
from evo.evaluate import evaluate, replay_of
from evo.layout import Arch, ROOT
from evo.pool import WorkerPool

VALIDATION_SEEDS = list(range(900_000, 900_020))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=datetime.now().strftime("evo-%m%d-%H%M"))
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--set", nargs="*", default=[], metavar="KEY=VALUE")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    run_dir = ROOT / "bot-evo" / "runs" / args.run
    (run_dir / "replays").mkdir(parents=True, exist_ok=True)
    (run_dir / "viz").mkdir(exist_ok=True)
    (run_dir / "stop.flag").unlink(missing_ok=True)

    cfg = config.load(run_dir)
    for kv in args.set:
        key, value = kv.split("=", 1)
        for group in config.GROUPS:
            if key in cfg[group]:
                cfg[group][key] = config.coerce(cfg[group][key], value)

    arch = Arch.from_cfg(cfg["network"])
    gen0, stage, best_val = 0, 0, -1.0
    gen_rng = torch.Generator(device=device)
    gen_rng.manual_seed(cfg["evolution"]["seed"])
    saved = None
    if args.resume and (run_dir / "state.pt").exists():
        saved = torch.load(run_dir / "state.pt", map_location=device)
        pop, gen0, stage, best_val = saved["pop"], saved["gen"], saved["stage"], saved["best_val"]
        if pop.shape[1] != arch.dim:
            raise SystemExit(f"Architektura sieci ({arch.dim} wag) nie pasuje do zapisanego modelu ({pop.shape[1]} wag). Wróć do starych rozmiarów warstw albo zacznij nowy model.")
        print(f"resumed at generation {gen0}")
    else:
        pop = net.init_population(cfg["evolution"]["pop"], device, gen_rng, arch)
    P = pop.shape[0]
    cfg["evolution"]["pop"] = P
    config.save(run_dir, cfg)

    ga = GA(device, cfg["evolution"]["seed"], cfg["evolution"])
    best_seen = -1e9
    if saved:
        ga.sigma, ga.stale = saved["sigma"], saved["stale"]
        ga.best = saved["best"] if saved["best"] is not None and saved["best"] > -1e8 else None
        ga.ema, best_seen = saved.get("ema"), saved.get("best_seen", -1e9)

    meta_path = run_dir / "run.json"
    created = json.loads(meta_path.read_text(encoding="utf8")).get("created") if meta_path.exists() else None
    created = created or datetime.now().isoformat(timespec="seconds")

    writer = SummaryWriter(str(run_dir / "tb"))
    writer.add_text("config", f"```\n{json.dumps(cfg, indent=2)}\n```", gen0)
    pool = WorkerPool(cfg["evolution"]["workers"])
    log = open(run_dir / "log.csv", "a", newline="")
    csv_out = csv.writer(log)
    if log.tell() == 0:
        csv_out.writerow(["gen", "length", "best", "mean", "median", "progress_best", "progress_top", "wins", "sigma", "seconds", "kframes_s"])
    print(f"run {args.run}: {P} genomes, {arch.dim} weights each, device {device}")
    print(f"tensorboard --logdir {run_dir.parent}", flush=True)

    def heartbeat(gen: int) -> None:
        write_json(run_dir / "running.json", {"pid": os.getpid(), "gen": gen, "time": time.time()})

    heartbeat(gen0)
    prev_best, prev_score_cfg, gen = None, cfg["score"], gen0
    try:
        while gen < config.load(run_dir)["evolution"]["gens"]:
            cfg = config.load(run_dir)
            evo = cfg["evolution"]
            fitness.configure(cfg["score"])
            ga.configure(evo)
            if cfg["score"] != prev_score_cfg:
                ga.reset_progress()
                best_val, best_seen, prev_score_cfg = -1.0, -1e9, cfg["score"]
                print("      score settings changed: best-so-far counters reset", flush=True)
            stages = config.stages(cfg)
            stage = min(stage, len(stages) - 1)
            length = stages[stage]
            limits = {"stallDecisions": evo["stallDecisions"], "maxDecisions": evo["maxDecisions"]}

            seeds = [int(x) for x in np.random.default_rng([evo["seed"], gen]).integers(1, 1_000_000, size=evo["levels"])]
            t0 = time.time()
            ev = evaluate(pool, pop, seeds, length, limits=limits, arch=arch)
            dt = time.time() - t0
            frames = sum(r.stats[:, 4].sum() for r in ev.runs)

            scores = torch.tensor(ev.scores, device=device)
            order = np.argsort(-ev.scores)
            n_elite = ga.n_elite(P)
            b = int(order[0])
            m = dict(best=float(ev.scores[b]), mean=float(ev.scores.mean()), median=float(np.median(ev.scores)),
                     progress_best=float(ev.progress[b]), progress_top=float(ev.progress[order[:n_elite]].mean()),
                     wins=float(ev.wins.sum() / (P * evo["levels"])))
            ga.adapt_sigma(float(ev.scores[order[:n_elite]].mean()))
            best_seen = max(best_seen, m["best"])

            for k, v in m.items():
                writer.add_scalar(f"train/{k}", v, gen)
            writer.add_scalar("train/sigma", ga.sigma, gen)
            writer.add_scalar("train/level_length", length, gen)
            writer.add_scalar("train/kframes_per_s", frames / dt / 1000, gen)
            csv_out.writerow([gen, length, *(round(v, 3) for v in m.values()), round(ga.sigma, 4), round(dt, 2), round(frames / dt / 1000)])
            log.flush()
            print(f"gen {gen:4d}  len {length:3d}  best {m['best']:7.1f}  mean {m['mean']:7.1f}  progress top10% {m['progress_top']:.2f}  "
                  f"wins {m['wins']:.2f}  sigma {ga.sigma:.3f}  {dt:.1f}s ({frames / dt / 1000:.0f}k fps)", flush=True)

            replay = replay_of(ev, b, length, "normal", {"run": args.run, "gen": gen, "score": m["best"]})
            write_json(run_dir / "replays" / f"gen_{gen:04d}.json", replay)
            write_json(run_dir / "latest.json", replay)
            best_vec = pop[b].clone()
            torch.save(best_vec, run_dir / "best_gen.pt")

            if gen % evo["vizEvery"] == 0:
                figs = {"net/weights": viz.weights_figure(best_vec, prev_best, gen, m["best"], arch),
                        "net/population": viz.population_figure(pop, ev.scores, gen)}
                run0 = ev.runs[0]
                alive = [int(i) for i in order if run0.snapshot_alive is not None and run0.snapshot_alive[i]]
                if alive:
                    figs["net/activations"] = viz.activation_figure(pop[alive[0]].clone(), run0.snapshot[alive[0]:alive[0] + 1], gen, arch)
                for tag, fig in figs.items():
                    writer.add_figure(tag, fig, gen)
                    fig.savefig(run_dir / "viz" / f"{tag.split('/')[1]}_{gen:04d}.png", dpi=80)
                    viz.plt.close(fig)
                viz.log_histograms(writer, pop, best_vec, gen, arch)
                writer.flush()
            prev_best = best_vec

            if gen % evo["valEvery"] == 0:
                cand = pop[torch.tensor(order[:5].copy(), device=device)]
                val = evaluate(pool, cand, VALIDATION_SEEDS, length, limits=limits, arch=arch)
                vb = int(np.argmax(val.scores))
                writer.add_scalar("validation/score", float(val.scores[vb]), gen)
                writer.add_scalar("validation/progress", float(val.progress[vb]), gen)
                writer.add_scalar("validation/wins", float(val.wins[vb]), gen)
                print(f"      validation: score {val.scores[vb]:.1f}  progress {val.progress[vb]:.2f}  wins {int(val.wins[vb])}/{len(VALIDATION_SEEDS)}", flush=True)
                if val.scores[vb] > best_val:
                    best_val = float(val.scores[vb])
                    torch.save(cand[vb].clone(), run_dir / "best_val.pt")
                    vr = replay_of(val, vb, length, "normal", {"run": args.run, "gen": gen, "score": best_val})
                    vr["levels"] = vr["levels"][:5]
                    write_json(run_dir / "best_val_replay.json", vr)

            if m["progress_top"] >= evo["stageProgress"] and stage < len(stages) - 1:
                stage += 1
                best_val = -1.0
                print(f"      stage {stage}: level length {stages[stage]}", flush=True)

            pop = ga.evolve(pop, scores)
            torch.save(dict(pop=pop, gen=gen + 1, stage=stage, best_val=best_val, sigma=ga.sigma, best=ga.best, stale=ga.stale, ema=ga.ema, best_seen=best_seen),
                       run_dir / "state.pt")
            gen += 1
            write_json(meta_path, {
                "name": args.run, "created": created, "updated": datetime.now().isoformat(timespec="seconds"),
                "generations": gen, "pop": P, "best": best_seen, "bestVal": best_val, "length": length, "stage": stage,
                "sigma": ga.sigma, "device": device, "dim": arch.dim, "network": cfg["network"], "evolution": evo, "score": cfg["score"],
            })
            heartbeat(gen)
            if (run_dir / "stop.flag").exists():
                print("stop requested", flush=True)
                break
    except KeyboardInterrupt:
        print("stopped; continue with --resume")
    finally:
        pool.close()
        writer.close()
        log.close()
        (run_dir / "running.json").unlink(missing_ok=True)
        (run_dir / "stop.flag").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
