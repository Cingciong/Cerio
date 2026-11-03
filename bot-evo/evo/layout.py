"""Shared constants: observation record (mirror of core/ai/observe.ts), network architecture, genome layout, buttons."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
GAME = json.loads((ROOT / "shared" / "game.json").read_text(encoding="utf8"))

W, H, MAX_ENEMIES, N_SCALARS, SLOTS = 32, 15, 16, 15, 32
ENEMY_FLOATS = 5
REPEAT = 4  # frames per decision, must match worker.ts

OBS_DTYPE = np.dtype([
    ("tiles", "u1", (H, W)),
    ("ents", "u1", (H, W)),
    ("etype", "u1", (MAX_ENEMIES,)),
    ("sc", "<f4", (N_SCALARS,)),
    ("en", "<f4", (MAX_ENEMIES, ENEMY_FLOATS)),
])

BUTTONS = ["left", "right", "jump", "run", "down", "attack"]
BUTTON_BITS = [GAME["buttons"][b] for b in BUTTONS]

TILE_NAMES = {t["id"]: name for name, t in GAME["tiles"].items()}
ENTITY_NAMES = {i + 1: n for i, n in enumerate([*GAME["enemies"], *GAME["items"], "fireball", "hammer"])}
POWER_NAMES = ["small", "big", "fire", "hammer_suit", "star", "leaf", "tanooki", "frog"]
SCALAR_NAMES = ["vx", "vy", "ground", "sub x", "sub y", *POWER_NAMES, "star timer", "cave"]


@dataclass(frozen=True)
class Arch:
    """Layer sizes. Embeddings -> conv -> conv -> flatten + enemy vector + scalars -> dense layers -> buttons.
    Settings: "network" section of bot-evo/defaults.json. dense3 / dense4 = 0 means the layer does not exist."""

    tile_emb: int = 4
    ent_emb: int = 3
    enemy_hidden: int = 8
    conv1: int = 8
    conv2: int = 8
    dense1: int = 32
    dense2: int = 16
    dense3: int = 0
    dense4: int = 0

    @classmethod
    def from_cfg(cls, c: dict) -> "Arch":
        return cls(int(c["tileEmb"]), int(c["entEmb"]), int(c["enemyHidden"]), int(c["conv1"]), int(c["conv2"]),
                   int(c["dense1"]), int(c["dense2"]), int(c.get("dense3", 0)), int(c.get("dense4", 0)))

    @property
    def in_ch(self) -> int:
        return self.tile_emb + self.ent_emb

    @property
    def flat(self) -> int:  # two stride-2 convolutions turn the 15x32 window into 4x8
        return self.conv2 * 4 * 8

    @property
    def hidden(self) -> list[int]:
        return [d for d in (self.dense1, self.dense2, self.dense3, self.dense4) if d > 0]

    @property
    def spec(self) -> list[tuple[str, tuple[int, ...]]]:
        return _spec(self)

    @property
    def sizes(self) -> dict[str, int]:
        return {n: int(np.prod(s)) for n, s in self.spec}

    @property
    def offsets(self) -> dict[str, int]:
        out, at = {}, 0
        for n, s in self.spec:
            out[n] = at
            at += int(np.prod(s))
        return out

    @property
    def dim(self) -> int:
        return sum(self.sizes.values())

    @property
    def fan_in(self) -> dict[str, int]:
        out = {"we": ENEMY_FLOATS + self.ent_emb, "c1": self.in_ch * 9, "c2": self.conv1 * 9, "wo": self.hidden[-1]}
        prev = self.flat + self.enemy_hidden + N_SCALARS
        for i, d in enumerate(self.hidden, 1):
            out[f"w{i}"] = prev
            prev = d
        return out


@lru_cache(maxsize=None)
def _spec(a: Arch) -> list[tuple[str, tuple[int, ...]]]:
    spec = [
        ("te", (SLOTS, a.tile_emb)),
        ("ee", (SLOTS, a.ent_emb)),
        ("we", (ENEMY_FLOATS + a.ent_emb, a.enemy_hidden)),
        ("be", (a.enemy_hidden,)),
        ("c1", (a.conv1, a.in_ch, 3, 3)),
        ("b1", (a.conv1,)),
        ("c2", (a.conv2, a.conv1, 3, 3)),
        ("b2", (a.conv2,)),
    ]
    prev = a.flat + a.enemy_hidden + N_SCALARS
    for i, d in enumerate(a.hidden, 1):
        spec += [(f"w{i}", (prev, d)), (f"d{i}", (d,))]
        prev = d
    return spec + [("wo", (prev, len(BUTTONS))), ("do", (len(BUTTONS),))]


DEFAULT_ARCH = Arch()
SPEC, SIZES, OFFSETS, DIM, FLAT = DEFAULT_ARCH.spec, DEFAULT_ARCH.sizes, DEFAULT_ARCH.offsets, DEFAULT_ARCH.dim, DEFAULT_ARCH.flat
