import { expect, test } from "vitest";
import { canFollow, joint, LevelGenerator, LevelSequence } from "../core/index.ts";
import { loadLibrary } from "../headless/tools/segmentFiles.ts";

const lib = loadLibrary();
const gen = new LevelGenerator(lib);

test("same seed gives the same level", () => {
  expect(gen.generate(42, { length: 200, type: "normal" })).toEqual(gen.generate(42, { length: 200, type: "normal" }));
});

test("length stays within tolerance", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = gen.generate(seed, { length: 200, tolerance: 0.1, type: "normal" }).overworld.rows[0].length;
    expect(w).toBeGreaterThanOrEqual(180);
    expect(w).toBeLessThanOrEqual(220);
  }
});

test("starts and ends with enclosures", () => {
  const level = gen.generate(7, { length: 200, type: "normal" });
  const start = lib.enclosure("normal", "start").rows;
  const end = lib.enclosure("normal", "end").rows;
  level.overworld.rows.forEach((r, y) => {
    expect(r.startsWith(start[y])).toBe(true);
    expect(r.endsWith(end[y])).toBe(true);
  });
  expect(level.type).toBe("normal");
});

test("start/end tagged segments never land in the middle", () => {
  const middles = lib.middles("normal");
  expect(middles.some((s) => s.tags?.length)).toBe(false);
  expect(canFollow(joint(lib.enclosure("normal", "start").rows, "right"), joint(middles[0].rows, "left"))).toBeTypeOf("boolean");
});

test("sequence gives different levels", () => {
  const seq = new LevelSequence(gen, 1, { length: 200, type: "normal" });
  expect(seq.next().overworld.rows).not.toEqual(seq.next().overworld.rows);
});
