import { Enemy } from "./enemy.ts";
import type { Level } from "./level.ts";
import { PLAYER } from "./config.ts";
import { Player } from "./player.ts";
import { SUB, TILE } from "./constants.ts";
import type { TileMap } from "./tiles.ts";

export type Status = "playing" | "dead" | "won";

export interface GameState {
  level: Level;
  map: TileMap;
  frame: number;
  status: Status;
  player: Player;
  enemies: Enemy[];
}

export function createState(level: Level): GameState {
  return {
    level,
    map: level.map,
    frame: 0,
    status: "playing",
    player: new Player(level.playerStart.x + ((TILE - PLAYER.w) / 2) * SUB, level.playerStart.y), // centred in the tile
    enemies: level.enemies.map((e, i) => new Enemy(i, e.type, e.x, e.y)),
  };
}
