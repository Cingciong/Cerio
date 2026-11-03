"""Play a whole population on one or more levels in lockstep: observe -> batched network -> buttons."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import torch

from . import fitness, net
from .layout import DEFAULT_ARCH, REPEAT, Arch

SNAPSHOT_ROUND = 30  # decision at which the observation is kept for the activation view


@dataclass
class LevelRun:
    seed: int
    stats: np.ndarray            # [P, 6]
    actions: np.ndarray          # [rounds, P] uint8
    rounds: np.ndarray           # [P] decisions each genome played
    snapshot: np.ndarray | None  # observation records at SNAPSHOT_ROUND [P]
    snapshot_alive: np.ndarray | None


@dataclass
class Evaluation:
    scores: np.ndarray           # [P] mean over levels
    progress: np.ndarray         # [P] mean over levels
    wins: np.ndarray             # [P] levels won
    runs: list[LevelRun] = field(default_factory=list)


def play_level(pool, pop: torch.Tensor, seed: int, length: int, level_type: str, limits: dict | None = None, arch: Arch = DEFAULT_ARCH) -> LevelRun:
    P = pop.shape[0]
    status, rec = pool.reset(seed, length, level_type, P, limits)
    history, rounds = [], np.zeros(P, dtype=np.int32)
    snapshot = snapshot_alive = None
    r = 0
    while not status.all():
        actions = net.to_buttons(net.forward(pop, net.Obs(rec, pop.device.type), arch=arch))
        if r == SNAPSHOT_ROUND:
            snapshot, snapshot_alive = rec.copy(), status == 0
        history.append(actions)
        rounds += status == 0
        status, rec = pool.step(actions)
        r += 1
    return LevelRun(seed, pool.results(), np.stack(history), rounds, snapshot, snapshot_alive)


def evaluate(pool, pop: torch.Tensor, seeds: list[int], length: int, level_type: str = "normal", limits: dict | None = None,
             arch: Arch = DEFAULT_ARCH) -> Evaluation:
    runs = [play_level(pool, pop, s, length, level_type, limits, arch) for s in seeds]
    return Evaluation(
        scores=np.mean([fitness.score(r.stats) for r in runs], axis=0),
        progress=np.mean([fitness.progress(r.stats) for r in runs], axis=0),
        wins=np.sum([r.stats[:, 3] for r in runs], axis=0),
        runs=runs,
    )


def replay_of(ev: Evaluation, index: int, length: int, level_type: str, meta: dict) -> dict:
    """Seed + buttons of one genome: enough to replay it exactly in the browser (the simulation is deterministic)."""
    return {
        **meta,
        "repeat": REPEAT,
        "levels": [
            {
                "seed": r.seed, "length": length, "type": level_type,
                "progress": float(fitness.progress(r.stats[index:index + 1])[0]),
                "coins": int(r.stats[index, 2]), "won": bool(r.stats[index, 3]),
                "actions": r.actions[:r.rounds[index], index].tolist(),
            }
            for r in ev.runs
        ],
    }
