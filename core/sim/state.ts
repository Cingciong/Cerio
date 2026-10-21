import { Enemy } from "../entities/enemy.ts";
import type { Level } from "../world/level.ts";
import { PLAYER } from "../config/config.ts";
import { Player } from "../entities/player.ts";
import { SUB, TILE } from "../config/constants.ts";
import type { TileMap } from "../world/tiles.ts";
import { createEnemy } from "../entities/enemy.ts";
import { Item } from "../entities/powerup.ts";
import type { Bump, Debris, GameEvent } from "./blocks.ts";
import type { PipeTravel } from "./pipes.ts";
import type { RedRing } from "./redcoins.ts";

export type Status = "playing" | "dead" | "won";

export interface GameState {
  level: Level;
  area: string; 
  map: TileMap; 
  maps: Record<string, TileMap>; 
  frame: number;
  status: Status;
  player: Player;
  items: Item[];
  enemies: Enemy[]; 
  areaEnemies: Record<string, Enemy[]>; 
  pipe?: PipeTravel;
  bumps: Bump[];
  debris: Debris[];
  events: GameEvent[]; 
  coins: number;
  multiCoins: Record<string, number>;
  redRings: RedRing[];
  redRingsCleared: number;
}

export function createState(level: Level): GameState {
  let id = 0;
  const areaEnemies: Record<string, Enemy[]> = {};
  const maps: Record<string, TileMap> = {};
  for (const [name, area] of Object.entries(level.areas)) {
    areaEnemies[name] = area.enemies.map((e) => createEnemy(id++, e.type, e.x, e.y));
    maps[name] = { ...area.map, tiles: area.map.tiles.slice() };
  }
  return {
    level,
    area: "overworld",
    map: maps.overworld,
    maps,
    frame: 0,
    status: "playing",
    player: new Player(level.playerStart.x + ((TILE - PLAYER.w) / 2) * SUB, level.playerStart.y), // centred in the tile
    items: [],
    enemies: areaEnemies.overworld,
    areaEnemies,
    bumps: [],
    debris: [],
    events: [],
    coins: 0,
    multiCoins: {},
    redRings: Object.entries(level.areas).flatMap(([name, a]) =>
      a.redRings.map((r) => ({ ...r, area: name, phase: "waiting" as const, timer: 0, collected: r.coins.map(() => false) })),
    ),
    redRingsCleared: 0,
  };
}

export function setArea(state: GameState, area: string): void {
  state.area = area;
  state.map = state.maps[area];
  state.enemies = state.areaEnemies[area];
  state.bumps = [];
  state.debris = [];
}
