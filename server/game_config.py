"""Python adapter for shared/game.json: the same constants the game (core/config.ts) uses.

    from game_config import GAME, Buttons, Tiles

    GAME.player.walkMax              # 24, any JSON value as an attribute
    GAME.enemies.goomba.speed        # 8

    Buttons.JUMP                     # 4
    Buttons.press("right", "jump")   # 6
    Buttons.names(6)                 # ["right", "jump"]
    Buttons.has(6, "jump")           # True

    Tiles.BLOCK                      # 1
    Tiles.name(1)                    # "block"
    Tiles.is_solid(1)                # True
    Tiles.COUNT                      # 2 (size of a one-hot vector)

Adding a button / tile / enemy in the JSON makes it available here automatically.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

PATH = Path(__file__).resolve().parent.parent / "shared" / "game.json"


def _ns(value: Any) -> Any:
    """dict -> attribute access, recursively."""
    if isinstance(value, dict):
        return SimpleNamespace(**{k: _ns(v) for k, v in value.items()})
    if isinstance(value, list):
        return [_ns(v) for v in value]
    return value


class _Buttons:
    def __init__(self, masks: dict[str, int]) -> None:
        self.masks = dict(masks)  # {"left": 1, ...}
        self.ALL = list(masks)  # names in JSON order
        for name, mask in masks.items():
            setattr(self, name.upper(), mask)

    def press(self, *names: str) -> int:
        mask = 0
        for n in names:
            mask |= self.masks[n]
        return mask

    def names(self, mask: int) -> list[str]:
        return [n for n, m in self.masks.items() if mask & m]

    def has(self, mask: int, name: str) -> bool:
        return bool(mask & self.masks[name])


class _Tiles:
    def __init__(self, tiles: dict[str, dict[str, Any]]) -> None:
        self.ids = {name: t["id"] for name, t in tiles.items()}  # {"air": 0, ...}
        self._by_id = {t["id"]: name for name, t in tiles.items()}
        self._solid = {t["id"]: t["solid"] for t in tiles.values()}
        self.COUNT = max(self._by_id) + 1
        for name, tile_id in self.ids.items():
            setattr(self, name.upper(), tile_id)

    def name(self, tile_id: int) -> str:
        return self._by_id[tile_id]

    def is_solid(self, tile_id: int) -> bool:
        return self._solid[tile_id]


RAW: dict[str, Any] = json.loads(PATH.read_text(encoding="utf-8"))
GAME = _ns(RAW)
Buttons = _Buttons(RAW["buttons"])
Tiles = _Tiles(RAW["tiles"])
