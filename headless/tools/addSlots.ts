// Adds a power-up slot (a `?` tile) to segments that have none, so the generator has something to fill.
// Only that one character of the segment file changes, the rest of the file is left as it is.
// Safe to run again: segments with a `?` are skipped. Run it again after segments are edited or added.
//
//   npm run slots                      dry run for normal segments: prints what would change
//   npm run slots -- --write           writes the files
//   npm run slots -- normal,castle     other themes (folders under levels/)

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findSlotSpot, type Segment } from "../../core/index.ts";

const write = process.argv.includes("--write");
const themes = (process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "normal").split(",");
const ROOT = join(import.meta.dirname, "..", "..", "levels");

let added = 0;
let skipped = 0;
for (const theme of themes) {
  const dir = join(ROOT, theme);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const path = join(dir, file);
    const text = readFileSync(path, "utf8");
    const seg: Segment = { ...JSON.parse(text), name: file.replace(".json", "") };
    if (seg.rows.some((r) => r.includes("?"))) continue;
    const spot = findSlotSpot(seg);
    if (!spot) {
      console.log(`${theme}/${file}: no safe spot`);
      skipped++;
      continue;
    }

    // edit the text, not the parsed JSON: the diff is one character per file
    const lines = text.split("\n");
    const start = lines.findIndex((l) => /"rows"\s*:\s*\[/.test(l)) + 1;
    const i = start + spot.y;
    const line = lines[i];
    const col = line.indexOf(`"`) + 1 + spot.x;
    if (start === 0 || line?.slice(line.indexOf(`"`) + 1, line.lastIndexOf(`"`)) !== seg.rows[spot.y] || line[col] !== ".") {
      console.log(`${theme}/${file}: rows are not one per line, skipped`);
      skipped++;
      continue;
    }
    lines[i] = line.slice(0, col) + "?" + line.slice(col + 1);
    const out = lines.join("\n");
    if (JSON.parse(out).rows[spot.y][spot.x] !== "?") throw new Error(`${file}: edit failed`);

    console.log(`${theme}/${file}: ? at x=${spot.x} y=${spot.y}`);
    if (write) writeFileSync(path, out);
    added++;
  }
}
console.log(`${write ? "added" : "would add"} ${added}, no spot ${skipped}${write ? "" : "  (dry run, use --write)"}`);
