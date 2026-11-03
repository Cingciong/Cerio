import { expect, test } from "vitest";
import { blockStats, createState, LevelGenerator, loadLevel } from "../core/index.ts";
import { loadLibrary } from "../headless/tools/segmentFiles.ts";

// Real segments, after `npm run slots -- --write`.

const gen = new LevelGenerator(loadLibrary());

test("generated normal levels have slots, start with a mushroom and load", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const level = gen.generate(seed, { length: 200, type: "normal" });
    const blocks = level.overworld.blocks!;
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].item).toBe("mushroom");
    for (const b of blocks) expect(level.overworld.rows[b.y - 1][b.x]).not.toBe("#"); // room for the item above the block
    expect(() => createState(loadLevel(level))).not.toThrow();
  }
});

test("rate 0 gives coins only on the real library", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const l = gen.generate(seed, { length: 200, type: "normal", powerups: { rate: 0 } });
    expect(Object.keys(blockStats([l.overworld]))).toEqual(["coin"]);
  }
});

test("castle levels still generate and load", () => {
  for (let seed = 1; seed <= 10; seed++) expect(() => loadLevel(gen.generate(seed, { length: 150, type: "castle" }))).not.toThrow();
});
