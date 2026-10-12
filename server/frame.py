"""Messages between the game and the server. Mirror of core/frame.ts.

GameFrame:   game -> server, player and all enemies in one frame.
ServerReply: server -> game, buttons for the player and/or enemies.
Units: px and px/frame, tiles as ids. Constants (buttons, tile ids): game_config.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from game_config import Buttons, Tiles


@dataclass
class BodyFrame:
    x: float  # px, top-left
    y: float
    vx: float  # px/frame
    vy: float
    w: int  # hitbox px
    h: int
    onGround: bool


@dataclass
class PlayerFrame(BodyFrame):
    alive: bool
    buttons: int  # bitmask

    @property
    def pressed(self) -> list[str]:
        """Button names, e.g. ["right", "jump"]."""
        return Buttons.names(self.buttons)


@dataclass
class EnemyFrame(BodyFrame):
    id: int
    type: str
    alive: bool


@dataclass
class TileView:
    left: int  # tile x of the top-left corner
    top: int
    width: int  # tiles
    height: int
    tiles: list[int]  # row-major tile ids

    def at(self, x: int, y: int) -> int:
        """Tile id at view coordinates (0..width-1, 0..height-1)."""
        return self.tiles[y * self.width + x]

    def solid(self, x: int, y: int) -> bool:
        return Tiles.is_solid(self.at(x, y))


@dataclass
class GameFrame:
    frame: int
    level: str
    status: str  # "playing" | "dead" | "won"
    player: PlayerFrame
    enemies: list[EnemyFrame]
    view: TileView

    @staticmethod
    def from_dict(d: dict[str, Any]) -> GameFrame:
        return GameFrame(
            frame=d["frame"],
            level=d["level"],
            status=d["status"],
            player=PlayerFrame(**d["player"]),
            enemies=[EnemyFrame(**e) for e in d["enemies"]],
            view=TileView(**d["view"]),
        )


@dataclass
class ServerReply:
    frame: int
    player: int | None = None  # buttons for the player; None -> keyboard
    enemies: dict[int, int] = field(default_factory=dict)  # buttons per enemy id

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"frame": self.frame, "enemies": self.enemies}
        if self.player is not None:
            d["player"] = self.player
        return d
