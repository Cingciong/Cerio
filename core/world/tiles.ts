
import { TILE_SUB } from "../config/constants.ts";
import { TILES, type TileName } from "../config/config.ts";


export const Tile = Object.fromEntries(Object.entries(TILES).map(([name, t]) => [name, t.id])) as Record<TileName, number>;

const SOLID: boolean[] = [];
const SEMISOLID: boolean[] = [];
const CHAR_TO_ID: Record<string, number> = {};
for (const t of Object.values(TILES)) {
  SOLID[t.id] = t.solid;
  SEMISOLID[t.id] = (t as {semisolid?: boolean}).semisolid ?? false;
  CHAR_TO_ID[t.char] = t.id;
}

export function tileIdOfChar(ch: string): number | undefined {
  return CHAR_TO_ID[ch];
}

export interface TileMap {
  width: number; // tiles
  height: number; // tiles
  tiles: Uint8Array; // row-major tile ids
}

export function createTileMap(width: number, height: number): TileMap {
  return { width, height, tiles: new Uint8Array(width * height) };
}

export function tileAt(map: TileMap, tx: number, ty: number): number {
  if (tx < 0 || tx >= map.width) return Tile.hard;
  if (ty < 0 || ty >= map.height) return Tile.air;
  return map.tiles[ty * map.width + tx];
}

export function setTile(map: TileMap, tx: number, ty: number, id: number): void {
  if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) map.tiles[ty * map.width + tx] = id;
}

export function isSolid(map: TileMap, tx: number, ty: number): boolean {
  return SOLID[tileAt(map, tx, ty)] ?? false;
}

export function isSemiSolid(map:TileMap, tx: number, ty: number):boolean
{
  return SEMISOLID[tileAt(map, tx, ty)] ?? false;
}

export function toTile(sub: number): number {
  return Math.floor(sub / TILE_SUB);
}

export function tileWindow(map: TileMap, left: number, top: number, width: number, height: number): number[] {
  const out: number[] = [];
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) out.push(tileAt(map, x, y));
  }
  return out;
}
