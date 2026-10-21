import { Enemy } from "./enemy.ts";
import type { Level } from "./level.ts";
import { PLAYER } from "./config.ts";
import { Player } from "./player.ts";
import { SUB, TILE } from "./constants.ts";
import type { TileMap } from "./tiles.ts";
import { createEnemy } from "./enemy.ts";
import type { RedRing } from "./redcoins.ts";

export type Status = "playing" | "dead" | "won";

export interface GameState {
  level: Level;
  map: TileMap;
  frame: number;
  status: Status;
  player: Player;
  enemies: Enemy[];
  coins: number;
  multiCoins: Record<number, number>;
  redRings: RedRing[];
  redRingCleared: number;
}

export function createState(level: Level): GameState {
  return {
    level,
    map: {... level.map, tiles: level.map.tiles.slice()},
    coins: 0,
    multiCoins: {},
    frame: 0,
    status: "playing",
    player: new Player(level.playerStart.x + ((TILE - PLAYER.w) / 2) * SUB, level.playerStart.y), // centred in the tile
    enemies: level.enemies.map((e, i) => createEnemy(i, e.type, e.x, e.y)),
    redRings: level.redRings.map((r) => ({ ...r, phase: "waiting" as const, timer: 0, collected: r.coins.map(() => false),})),
    redRingsCleared: 0,
  };
}
