// Level generator: seed + params -> LevelFile. Same seed and segments -> same level.

import type { LevelFile } from "./level.ts";
import { Rng } from "./rng.ts";
import { canFollow, joint, type Segment } from "./segment.ts";

export interface GenParams {
  length: number;
  maxDifficulty: number;
  themes: string[];
}

const H = 15;
const themeOf = (s: Segment) => s.theme ?? "overworld";
const isEnd = (s: Segment) => s.tags?.includes("end") || s.rows.some((r) => r.includes("F") || r.includes("A"));
const isSpecial = (s: Segment) => s.tags?.some((t) => t === "room" || t === "start") ?? false;

export function generate(all: Segment[], seed: number, p: GenParams): LevelFile {
  const rng = new Rng(seed);
  const pool = [...all]
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .filter((s) => s.rows.length === H && (s.difficulty ?? 1) <= p.maxDifficulty);
  const theme = rng.pick(p.themes);
  const ofTheme = pool.filter((s) => themeOf(s) === theme);
  const middles = ofTheme.filter((s) => !isEnd(s) && !isSpecial(s));
  const ends = ofTheme.filter(isEnd);

  // Start: 4 columns of flat ground for the player.
  const start: Segment = { name: "start", rows: [...Array(H - 2).fill("...."), "####", "####"], enemies: [] };
  const parts: Segment[] = [start];
  let width = 4;

  while (width < p.length) {
    const prev = joint(parts[parts.length - 1].rows, "right");
    const fits = middles.filter((s) => canFollow(prev, joint(s.rows, "left")));
    if (fits.length === 0) break;
    const next = rng.pick(fits);
    parts.push(next);
    width += next.rows[0].length;
  }

  const prev = joint(parts[parts.length - 1].rows, "right");
  const endFits = ends.filter((s) => canFollow(prev, joint(s.rows, "left")));
  if (endFits.length === 0) throw new Error(`generate(${seed}): no end segment fits (${theme})`);
  parts.push(rng.pick(endFits));

  return join(parts, `gen-${theme}-${seed}`);
}

/** Glue rows side by side, shift enemies by the segment's position. */
function join(parts: Segment[], name: string): LevelFile {
  const rows: string[] = Array.from({ length: H }, () => "");
  const enemies: LevelFile["enemies"] = [];
  let x0 = 0;
  for (const s of parts) {
    const w = Math.max(...s.rows.map((r) => r.length));
    s.rows.forEach((r, y) => (rows[y] += r.padEnd(w, ".")));
    for (const e of s.enemies) enemies.push({ ...e, x: e.x + x0 });
    x0 += w;
  }
  return { name, rows, enemies, player: { x: 1, y: H - 3 } };
}