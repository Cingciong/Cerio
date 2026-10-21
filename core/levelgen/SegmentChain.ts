import { joint, type Joint } from "./segment.ts";
import type { LevelFile } from "../world/level.ts";
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
  join(name: string): LevelFile {
    const rows: string[] = Array.from({ length: H }, () => "");
    const file: Required<Pick<LevelFile, "enemies" | "objects" | "spawners">> = { enemies: [], objects: [], spawners: [] };
    const segments: LevelFile["segments"] = [];
    let player: LevelFile["player"];
    let x0 = 0;
    for (const s of this.parts) {
      const w = widthOf(s);
      s.rows.forEach((r, y) => (rows[y] += r.padEnd(w, ".")));
      for (const e of s.enemies ?? []) file.enemies.push({ ...e, x: e.x + x0 });
      for (const o of s.objects ?? []) file.objects.push({ ...o, x: o.x + x0 });
      for (const sp of s.spawners ?? []) file.spawners.push({ ...sp, from: sp.from + x0, to: sp.to + x0 });
      segments.push({ name: s.name, x: x0, w });
      if (!player && s.player) player = { x: s.player.x + x0, y: s.player.y };
      x0 += w;
    }
    return { name, rows, player, segments, ...file };
  }
}
