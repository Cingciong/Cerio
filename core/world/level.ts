import { ENEMIES } from "../config/config.ts";
import { TILE_SUB } from "../config/constants.ts";
import { createTileMap, Tile, tileIdOfChar, type TileMap } from "./tiles.ts";

export interface LevelFile {
  name: string;
  rows: string[];
  player?: { x: number; y: number };
  type?: string;
  enemies: { type: string; x: number; y: number }[];
  objects?: { type: string; x: number; y: number }[];
  spawners?: { type: string; from: number; to: number }[];
  segments?: SegmentSpan[];
}

/** Where each generated segment sits in the level, in tiles. Debug only. */
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

export interface Level {
  name: string;
  type: string;
  segments: SegmentSpan[];
  map: TileMap;
  playerStart: Spawn;
  enemies: EnemySpawn[];
}

export function loadLevel(file: LevelFile): Level {
  const width = Math.max(...file.rows.map((r) => r.length));
  const map = createTileMap(width, file.rows.length);

  file.rows.forEach((row, ty) => {
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx];
      const id = ch === undefined ? Tile.air : tileIdOfChar(ch); // short rows are padded with air
      if (id === undefined) throw new Error(`${file.name}: unknown tile '${ch}' at ${tx},${ty}`);
      map.tiles[ty * width + tx] = id;
    }
  });

  for (const e of file.enemies ?? []) {
    if (!ENEMIES[e.type]) throw new Error(`${file.name}: unknown enemy type '${e.type}'`);
  }

  if (!file.player) throw new Error(`${file.name}: no player start`);
  
  return {
    name: file.name,
    type: file.type ?? "normal",
    segments: file.segments ?? [],
    map,
    playerStart: { x: file.player.x * TILE_SUB, y: file.player.y * TILE_SUB },
    enemies: (file.enemies ?? []).map((e) => ({ type: e.type, x: e.x * TILE_SUB, y: e.y * TILE_SUB })),
  };
}
