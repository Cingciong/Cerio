import { ENEMIES } from "../config/config.ts";
import { TILE_SUB } from "../config/constants.ts";
import type { PipeLink } from "./pipes.ts";
import { createTileMap, Tile, tileIdOfChar, type TileMap } from "./tiles.ts";


export interface AreaFile {
  rows: string[];
  enemies: { type: string; x: number; y: number }[];
  objects?: { type: string; x: number; y: number }[];
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
}

export interface Area {
  map: TileMap;
  enemies: EnemySpawn[];
  segments: SegmentSpan[];
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
  }

  return {
    map,
    enemies: (file.enemies ?? []).map((e) => ({ type: e.type, x: e.x * TILE_SUB, y: e.y * TILE_SUB })),
    segments: file.segments ?? [],
  };
}
