import { Enemy } from "../entities/enemy.ts";
import type { Level } from "../world/level.ts";
import { PLAYER } from "../config/config.ts";
import { Player } from "../entities/player.ts";
import { SUB, TILE } from "../config/constants.ts";
import type { TileMap } from "../world/tiles.ts";
import { createEnemy } from "../entities/enemy.ts";
import { Item } from "../entities/powerup.ts";
import type { Projectile } from "../entities/projectile.ts";
import type { Bump, Debris, GameEvent } from "./blocks.ts";
import type { PipeTravel } from "./pipes.ts";
import { Platform } from "../entities/platform.ts";
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
  projectiles: Projectile[];
  enemies: Enemy[]; // enemies of the current area
  platforms: Platform[];
  areaEnemies: Record<string, Enemy[]>; // enemies of other areas stay paused
  areaPlatforms: Record<string, Platform[]>;
  pipe?: PipeTravel; // set while sliding through a pipe
  standingPlatform?: Platform | null;
  bumps: Bump[];
  debris: Debris[];
  events: GameEvent[]; 
  freezeTimer: number;
  coins: number;
  multiCoins: Record<string, number>;
  redRings: RedRing[];
  redRingsCleared: number;
}

export function createState(level: Level): GameState {
  let id = 0;
  let platformId = 0;
  const areaEnemies: Record<string, Enemy[]> = {};
  const areaPlatforms: Record<string, Platform[]> = {};
  const maps: Record<string, TileMap> = {};
  for (const [name, area] of Object.entries(level.areas)) {
    areaEnemies[name] = area.enemies.map((e) => createEnemy(id++, e.type, e.x, e.y, e.count));
    areaPlatforms[name] = (area.platforms ?? []).map(
      (p) => new Platform(platformId++, p.x, p.y, p.w, p.h, p.type, p.range, p.speed, p.dir)
    );
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
    projectiles: [],
    enemies: areaEnemies.overworld,
    platforms: areaPlatforms.overworld ?? [],
    areaEnemies,
    areaPlatforms,
    standingPlatform: null,
    freezeTimer: 0,
    bumps: [],
    debris: [],
    events: [],
    coins: 0,
    multiCoins: {},
    redRings: Object.entries(level.areas).flatMap(([name, a]) =>
      (a.redRings ?? []).map((r) => ({ ...r, area: name, phase: "waiting" as const, timer: 0, collected: r.coins.map(() => false) })),
    ),
    redRingsCleared: 0,
  };
}

export function setArea(state: GameState, area: string): void {
  state.area = area;
  state.map = state.maps[area];
  state.enemies = state.areaEnemies[area];
  state.platforms = state.areaPlatforms[area] ?? [];
  state.standingPlatform = null;
  state.freezeTimer = 0;
  state.bumps = [];
  state.debris = [];
  state.projectiles = [];
}
