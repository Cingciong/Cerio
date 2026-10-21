import { joint, type Joint } from "./segment.ts";
import type { AreaFile, LevelFile } from "../world/level.ts";
import type { Segment } from "./types.ts";

const H = 15;
export const widthOf = (s: Segment) => Math.max(...s.rows.map((r) => r.length));

export class SegmentChain {
  private parts: Segment[] = [];
  width = 0;

  push(s: Segment): void {
    this.parts.push(s);
    this.width += widthOf(s);
  }

  pop(): void {
    const s = this.parts.pop();
    if (s) this.width -= widthOf(s);
  }

  get length(): number {
    return this.parts.length;
  }

  rightJoint(): Joint {
    return joint(this.parts[this.parts.length - 1].rows, "right");
  }

  /** Glue rows side by side and shift everything positioned in x by the segment's offset. */
  join(): { area: AreaFile; player?: LevelFile["player"] } {
    const area: Required<AreaFile> = {
      rows: Array.from({ length: H }, () => ""),
      enemies: [],
      platforms: [],
      objects: [],
      spawners: [],
      segments: [],
    };
    let player: LevelFile["player"];
    let x0 = 0;
    for (const s of this.parts) {
      const w = widthOf(s);
      s.rows.forEach((r, y) => (area.rows[y] += r.padEnd(w, ".")));
      for (const e of s.enemies ?? []) area.enemies.push({ ...e, x: e.x + x0 });
      for (const p of s.platforms ?? []) area.platforms.push({ ...p, x: p.x + x0 });
      for (const o of s.objects ?? []) area.objects.push({ ...o, x: o.x + x0 });
      for (const sp of s.spawners ?? []) area.spawners.push({ ...sp, from: sp.from + x0, to: sp.to + x0 });
      area.segments.push({ name: s.name, x: x0, w });
      if (!player && s.player) player = { x: s.player.x + x0, y: s.player.y };
      x0 += w;
    }
    return { area, player };
  }
}
