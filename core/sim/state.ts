import { Enemy } from "../entities/enemy.ts";
import type { Level } from "../world/level.ts";
import { PLAYER } from "../config/config.ts";
import { Player } from "../entities/player.ts";
import { SUB, TILE } from "../config/constants.ts";
import type { TileMap } from "../world/tiles.ts";
import { createEnemy } from "../entities/enemy.ts";
import { Item } from "../entities/powerup.ts";
import type { PipeTravel } from "./pipes.ts";

export type Status = "playing" | "dead" | "won";

export interface GameState {
  level: Level;
  area: string; // "overworld" or "cave"
  map: TileMap; // map of the current area
  frame: number;
  status: Status;
  player: Player;
  enemies: Enemy[];
  items: Item[];
  areaEnemies: Record<string, Enemy[]>; // enemies of other areas stay paused
  pipe?: PipeTravel; // set while sliding through a pipe
}

export function createState(level: Level): GameState {
  let id = 0;
  const areaEnemies: Record<string, Enemy[]> = {};
  for (const [name, area] of Object.entries(level.areas)) {
    areaEnemies[name] = area.enemies.map((e) => createEnemy(id++, e.type, e.x, e.y));
  }
  return {
    level,
    area: "overworld",
    map: level.map,
    frame: 0,
    status: "playing",
    player: new Player(level.playerStart.x + ((TILE - PLAYER.w) / 2) * SUB, level.playerStart.y), // centred in the tile
    items: [],
    enemies: areaEnemies.overworld,
    areaEnemies,
  };
}

export function setArea(state: GameState, area: string): void {
  state.area = area;
  state.map = state.level.areas[area].map;
  state.enemies = state.areaEnemies[area];
}
