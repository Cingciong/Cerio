// Level file (JSON):
//
// {
//   "name": "level1",
//   "rows": ["....", "####"],           // one character per 16x16 tile, top to bottom
//   "player": { "x": 3, "y": 12 },      // tile coordinates
//   "enemies": [{ "type": "goomba", "x": 26, "y": 12 }]
// }
//
// Tile characters and enemy types come from shared/game.json.

import { ENEMIES } from "./config.ts";
import { TILE_SUB } from "./constants.ts";
import { createTileMap, Tile, tileIdOfChar, type TileMap } from "./tiles.ts";

export interface LevelFile {
  name: string;
  rows: string[];
  player: { x: number; y: number };
  enemies: { type: string; x: number; y: number }[];
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

  for (const e of file.enemies) {
    if (!ENEMIES[e.type]) throw new Error(`${file.name}: unknown enemy type '${e.type}'`);
  }

  return {
    name: file.name,
    map,
    playerStart: { x: file.player.x * TILE_SUB, y: file.player.y * TILE_SUB },
    enemies: file.enemies.map((e) => ({ type: e.type, x: e.x * TILE_SUB, y: e.y * TILE_SUB })),
  };
}
