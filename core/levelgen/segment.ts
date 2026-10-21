
import { TILES } from "../config/config.ts";

export interface Joint {
  ground: number;
  floor: boolean;
  gap: number;
}

export const MAX_UP = 4;
export const MAX_GAP = 4;

const SOLID = new Set(Object.values(TILES).filter((t) => t.solid).map((t) => t.char));

const column = (rows: string[], x: number) => rows.map((r) => r[x] ?? ".");

/** Height of the surface the player walks on: skip the pit from below, climb the first solid stack. */
function surface(col: string[]): number {
  let r = col.length - 1;
  while (r >= 0 && !SOLID.has(col[r])) r--;
  if (r < 0) return 0;
  while (r >= 0 && SOLID.has(col[r])) r--;
  return col.length - (r + 1);
}

export function joint(rows: string[], side: "left" | "right"): Joint {
  const width = rows[0].length;
  const edge = side === "left" ? 0 : width - 1;
  const dir = side === "left" ? 1 : -1;
  const col = column(rows, edge);
  let gap = 0;
  for (let x = edge; x >= 0 && x < width && surface(column(rows, x)) === 0; x += dir) gap++;
  return { ground: surface(col), floor: SOLID.has(col[col.length - 1]), gap };
}

export function canFollow(a: Joint, b: Joint): boolean {
  if (a.gap + b.gap > MAX_GAP) return false;
  if (a.ground > 0 && b.ground > 0 && b.ground - a.ground > MAX_UP) return false;
  return true;
}