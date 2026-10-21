import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SegmentLibrary, type Segment } from "../../core/index.ts";

const ROOT = join(import.meta.dirname, "..", "..", "levels");

const readDir = (dir: string): Segment[] => {
  const path = join(ROOT, dir);
  try {
    return readdirSync(path).filter((f) => f.endsWith(".json")).map((f) => ({ ...JSON.parse(readFileSync(join(path, f), "utf8")), name: f.replace(".json", "") }));
  } catch {
    return [];
  }
};

export function loadLibrary(): SegmentLibrary {
  return new SegmentLibrary(["normal", "castle", "caves"].flatMap(readDir), readDir("enclosure"));
}
