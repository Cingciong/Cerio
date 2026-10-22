import { ENEMIES } from "../config/config.ts";
import { TILE, TILE_SUB } from "../config/constants.ts";
import type { PipeLink } from "./pipes.ts";
import { createTileMap, Tile, tileIdOfChar, type TileMap } from "./tiles.ts";

export interface AreaFile {
  rows: string[];
  enemies: { type: string; x: number; y: number; count?: number }[];
  platforms?: {
    type: "horizontal" | "vertical";
    x: number;
    y: number;
    w?: number;
    h?: number;
    range?: number;
    speed?: number;
    dir?: 1 | -1;
  }[];
  objects?: { type: string; x: number; y: number; coins?: [number, number][] }[];
  spawners?: { type: string; from: number; to: number }[];
  segments?: SegmentSpan[];
}

/** Single-area level or segment. */
export interface LevelFile extends AreaFile {
  name: string;
  player?: { x: number; y: number };
  type?: string;
}

/** Generated level: overworld, optional cave and the pipes between them. */
export interface AreasFile {
  name: string;
  type?: string;
  player: { x: number; y: number };
  overworld: AreaFile;
  cave?: AreaFile;
  pipes: PipeLink[];
}

/** Where each generated segment sits in the area, in tiles. Debug only. */
export interface SegmentSpan {
  name: string;
  x: number;
  w: number;
}

export interface Spawn {
  x: number; // subpixels, top-left of the tile
  y: number;
}

export interface EnemySpawn extends Spawn {
  type: string;
  count?: number;
}

export interface PlatformSpawn extends Spawn {
  type: "horizontal" | "vertical";
  w: number;
  h: number;
  range: number;
  speed?: number;
  dir?: 1 | -1;
}

export interface PlatformSpawn extends Spawn {
  type: "horizontal" | "vertical";
  w: number;
  h: number;
  range: number;
  speed?: number;
  dir?: 1 | -1;
}

export interface Area {
  map: TileMap;
  enemies: EnemySpawn[];
  platforms: PlatformSpawn[];
  segments: SegmentSpan[];
  redRings: { x: number; y: number; coins: { x: number; y: number }[] }[];
}

export interface Level extends Area {
  name: string;
  type: string;
  areas: Record<string, Area>; // "overworld" (same as map/enemies/segments above) and optionally "cave"
  pipes: PipeLink[];
  playerStart: Spawn;
}

export function loadLevel(file: LevelFile | AreasFile): Level {
  const f: Partial<AreasFile> = "overworld" in file ? file : { ...file, overworld: file, pipes: [] };
  if (!f.player) throw new Error(`${file.name}: no player start`);

  const overworld = loadArea(f.overworld!, file.name);
  const areas: Record<string, Area> = { overworld };
  if (f.cave) areas.cave = loadArea(f.cave, `${file.name}/cave`);

  return {
    name: file.name,
    type: file.type ?? "normal",
    ...overworld,
    areas,
    pipes: f.pipes ?? [],
    playerStart: { x: f.player.x * TILE_SUB, y: f.player.y * TILE_SUB },
  };
}

function loadArea(file: AreaFile, name: string): Area {
  const width = Math.max(...file.rows.map((r) => r.length));
  const map = createTileMap(width, file.rows.length);

  file.rows.forEach((row, ty) => {
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx];
      const id = ch === undefined ? Tile.air : tileIdOfChar(ch); // short rows are padded with air
      if (id === undefined) throw new Error(`${name}: unknown tile '${ch}' at ${tx},${ty}`);
      map.tiles[ty * width + tx] = id;
    }
  });

  for (const e of file.enemies ?? []) {
    if (!ENEMIES[e.type]) throw new Error(`${name}: unknown enemy type '${e.type}'`);
    if (e.count !== undefined && (e.type !== "goomba" || !Number.isInteger(e.count) || e.count < 1)) {
      throw new Error(`${name}: count must be a positive integer and is only supported for goombas`);
    }
  }

  return {
    map,
    enemies: (file.enemies ?? []).map((e) => ({
      type: e.type,
      x: e.x * TILE_SUB,
      y: e.y * TILE_SUB,
      ...(e.count === undefined ? {} : { count: e.count }),
    })),
    platforms: [
      ...(file.platforms ?? []).map((p) => {
        const w = p.w !== undefined ? (p.w <= 16 ? p.w * TILE : p.w) : 3 * TILE;
        const h = p.h !== undefined ? (p.h <= 2 ? p.h * TILE : p.h) : 8;
        const range = p.range !== undefined ? (p.range <= 16 ? p.range * TILE : p.range) : 4 * TILE;
        return {
          type: p.type,
          x: p.x * TILE_SUB,
          y: p.y * TILE_SUB,
          w,
          h,
          range,
          speed: p.speed,
          dir: p.dir,
        };
      }),
      ...(file.objects ?? [])
        .filter((o) => o.type === "lift")
        .map((o) => ({
          type: "vertical" as const,
          x: o.x * TILE_SUB,
          y: o.y * TILE_SUB,
          w: 2 * TILE,
          h: 8,
          range: 3.5 * TILE,
          speed: 1,
          dir: 1 as const,
        })),
    ],
    segments: file.segments ?? [],
    redRings: (file.objects ?? []).filter((o) => o.type === "red_ring").map((o) => ({
      x: o.x * TILE_SUB,
      y: o.y * TILE_SUB,
      coins: (o.coins ?? []).map(([x, y]) => ({ x: x * TILE_SUB, y: y * TILE_SUB })),
    })),
  };
}
