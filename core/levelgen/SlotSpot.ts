import { TILES } from "../config/config.ts";
import type { Segment } from "./types.ts";

const QUESTION = TILES.question.char;
const PIPE = new Set(["<", ">", "[", "]"]);

const GROUND = new Set(["#", "H", "-"]);
const HEIGHT = 4;
const EDGE = 3;
const ENEMY_RADIUS = 2;
const OBJECT_RADIUS = 3;
const PLATFORM_RADIUS = 6;

const at = (rows: string[], x: number, y: number) => rows[y]?.[x] ?? ".";
const air = (rows: string[], x: number, y: number) => at(rows, x, y) === ".";


export function findSlotSpot(s: Segment): { x: number; y: number } | undefined {
  const rows = s.rows;
  const w = Math.max(...rows.map((r) => r.length));
  if (rows.some((r) => r.includes(QUESTION)) || s.tags?.includes("end")) return undefined;

  let best: { x: number; y: number } | undefined;
  for (let x = EDGE; x < w - EDGE; x++) {
    if ((s.enemies ?? []).some((e) => Math.abs(e.x - x) <= ENEMY_RADIUS)) continue;
    if ((s.objects ?? []).some((o) => Math.abs(o.x - x) <= OBJECT_RADIUS)) continue;
    if ((s.platforms ?? []).some((p) => Math.abs(p.x - x) <= PLATFORM_RADIUS)) continue;
    for (let y = 2; y + HEIGHT < rows.length; y++) {
      const cols = [x - 1, x, x + 1];
      const ok =
        cols.every((cx) => GROUND.has(at(rows, cx, y + HEIGHT))) &&
        cols.every((cx) => [1, 2, 3].every((d) => air(rows, cx, y + d))) &&
        [x - 1, x, x + 1].every((cx) => air(rows, cx, y)) &&
        air(rows, x, y - 1) &&
        air(rows, x, y - 2) &&
        rows.every((r) => ![x - 2, x - 1, x, x + 1, x + 2].some((cx) => PIPE.has(r[cx] ?? ".")));
      if (!ok) continue;
      if (!best || Math.abs(x - w / 2) < Math.abs(best.x - w / 2)) best = { x, y };
    }
  }
  return best;
}
