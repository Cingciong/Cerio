import { Enemy } from "../entities/enemy.ts";
import type { Level } from "../world/level.ts";
import { PLAYER } from "../config/config.ts";
import { Player } from "../entities/player.ts";
import { SUB, TILE } from "../config/constants.ts";
import type { TileMap } from "../world/tiles.ts";
import { createEnemy } from "../entities/enemy.ts";
import { Item } from "../entities/powerup.ts";

export type Status = "playing" | "dead" | "won";

export interface GameState {
  level: Level;
  map: TileMap;
  frame: number;
  status: Status;
  player: Player;
  enemies: Enemy[];
  items: Item[];
}

export function createState(level: Level): GameState {
  return {
    level,
    map: level.map,
    frame: 0,
    status: "playing",
    player: new Player(level.playerStart.x + ((TILE - PLAYER.w) / 2) * SUB, level.playerStart.y), // centred in the tile
    enemies: level.enemies.map((e, i) => createEnemy(i, e.type, e.x, e.y)),
    items: [],
  };
}
