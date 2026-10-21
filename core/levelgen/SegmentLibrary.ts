import { ENEMIES } from "../config/config.ts";
import { tileIdOfChar } from "../world/tiles.ts";
import type { LevelType, Segment } from "./types.ts";

const H = 15;
const has = (s: Segment, tag: string) => s.tags?.includes(tag) ?? false;

/** Unknown tiles or enemies would crash loadLevel, so such segments are skipped. */
function valid(s: Segment): boolean {
  const tile = s.rows.join("").split("").find((c) => tileIdOfChar(c) === undefined);
  const enemy = (s.enemies ?? []).find((e) => !ENEMIES[e.type]);
  if (tile || enemy) console.warn(`segment ${s.name} skipped: unknown ${tile ? `tile '${tile}'` : `enemy '${enemy!.type}'`}`);
  return !tile && !enemy;
}

/** Segments grouped by type, sorted by name so the same seed gives the same level. */
export class SegmentLibrary {
  private byType = new Map<LevelType, Segment[]>();
  private enclosures = new Map<string, Segment>();

  constructor(segments: Segment[], enclosures: Segment[]) {
    const sorted = [...segments].filter((s) => s.rows.length === H && valid(s)).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const s of sorted) {
      const type = s.theme ?? "normal";
      this.byType.set(type, [...(this.byType.get(type) ?? []), s]);
    }
    for (const e of enclosures) this.enclosures.set(`${e.theme ?? "normal"}_${has(e, "start") ? "start" : "end"}`, e);
  }

  types(): LevelType[] {
    return [...this.byType.keys()].sort();
  }

  middles(type: LevelType): Segment[] {
    return this.of(type).filter((s) => !has(s, "start") && !has(s, "end"));
  }

  openers(type: LevelType): Segment[] {
    return this.of(type).filter((s) => has(s, "start"));
  }

  closers(type: LevelType): Segment[] {
    return this.of(type).filter((s) => has(s, "end"));
  }

  enclosure(type: LevelType, side: "start" | "end"): Segment {
    const e = this.enclosures.get(`${type}_${side}`) ?? this.enclosures.get(`normal_${side}`);
    if (!e) throw new Error(`no ${side} enclosure for ${type}`);
    return e;
  }

  private of(type: LevelType): Segment[] {
    return this.byType.get(type) ?? [];
  }
}
