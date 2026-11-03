import { expect, test } from "vitest";
import {
  Button,
  blockStats,
  createState,
  fillSlots,
  LevelGenerator,
  loadLevel,
  Rng,
  SegmentChain,
  SegmentLibrary,
  step,
  type GameState,
  type LevelFile,
  type Segment,
} from "../core/index.ts";

// ---- runtime: a ? block gives what the level planned ----

function level(blocks: LevelFile["blocks"], power?: "big"): GameState {
  const rows = [...Array(8).fill("........"), "...?....", "........", "........", "........", "........", "########", "########"];
  const state = createState(loadLevel({ name: "slots", rows, player: { x: 3, y: 12 }, enemies: [], blocks }));
  if (power) state.player.powerState = power;
  return state;
}

function hit(state: GameState): void {
  for (let i = 0; i < 3; i++) step(state, 0);
  for (let i = 0; i < 20; i++) step(state, Button.jump);
}

test("a planned item comes out of the block", () => {
  const state = level([{ x: 3, y: 8, item: "leaf" }]);
  hit(state);
  expect(state.items.map((i) => i.type)).toEqual(["leaf"]);
});

test("a coin block gives a coin and no item", () => {
  const state = level([{ x: 3, y: 8, item: "coin" }]);
  hit(state);
  expect(state.items).toHaveLength(0);
  expect(state.coins).toBe(1);
});

test("a planned mushroom turns into a flower for big Mario, like in SMB", () => {
  const state = level([{ x: 3, y: 8, item: "mushroom" }], "big");
  hit(state);
  expect(state.items.map((i) => i.type)).toEqual(["flower"]);
});

test("a ? without a plan still gives an item (hand-made levels)", () => {
  const state = level(undefined);
  hit(state);
  expect(state.items.map((i) => i.type)).toEqual(["mushroom"]);
});

test("the plan does not use the gameplay rng", () => {
  const state = level([{ x: 3, y: 8, item: "leaf" }]);
  const before = JSON.stringify(state.rng);
  hit(state);
  expect(JSON.stringify(state.rng)).toBe(before);
});

test("blocks off a ? tile or with an unknown item are rejected", () => {
  const rows = Array(14).fill("........");
  rows.push("###?####");
  const file = { name: "bad", rows, player: { x: 1, y: 12 }, enemies: [] };
  expect(() => loadLevel({ ...file, blocks: [{ x: 0, y: 14, item: "coin" }] })).toThrow(/not on a '\?'/);
  expect(() => loadLevel({ ...file, blocks: [{ x: 3, y: 14, item: "banana" }] })).toThrow(/unknown block item/);
  expect(() => loadLevel({ ...file, blocks: [{ x: 3, y: 14, item: "coin" }, { x: 3, y: 14, item: "leaf" }] })).toThrow(/two block items/);
});

// ---- generator: synthetic library, so the tests do not depend on the segment files ----

const rows = (q: number[]): string[] =>
  Array.from({ length: 15 }, (_, y) => (y >= 13 ? "#".repeat(16) : y === 9 ? ".".repeat(16).split("").map((c, x) => (q.includes(x) ? "?" : c)).join("") : ".".repeat(16)));
const seg = (name: string, q: number[], tags?: string[]): Segment => ({ name, theme: "normal", tags, rows: rows(q), enemies: [] });
const lib = () =>
  new SegmentLibrary([seg("a", [4, 9]), seg("b", [6]), seg("c", [3, 12])], [seg("s", [], ["start"]), seg("e", [], ["end"])]);
const gen = new LevelGenerator(lib());
const opts = { length: 160, type: "normal" as const };

test("the policy never changes the layout", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const base = gen.generate(seed, opts);
    for (const rate of [0, 0.5, 1]) {
      const other = gen.generate(seed, { ...opts, powerups: { rate } });
      expect(other.overworld.rows).toEqual(base.overworld.rows);
      expect(other.overworld.enemies).toEqual(base.overworld.enemies);
    }
  }
});

test("same seed and policy give the same contents", () => {
  expect(gen.generate(5, opts).overworld.blocks).toEqual(gen.generate(5, opts).overworld.blocks);
  expect(gen.generate(5, opts).overworld.blocks).not.toEqual(gen.generate(6, opts).overworld.blocks);
});

test("every ? gets exactly one entry and the entries sit on ? tiles", () => {
  const level = gen.generate(3, opts);
  const slots = level.overworld.rows.join("").split("?").length - 1;
  expect(slots).toBeGreaterThan(4);
  expect(level.overworld.blocks).toHaveLength(slots);
  for (const b of level.overworld.blocks!) expect(level.overworld.rows[b.y][b.x]).toBe("?");
  expect(() => loadLevel(level)).not.toThrow();
});

test("rate 0: only coins. rate 1: every slot a power-up, the first one a mushroom", () => {
  const none = gen.generate(3, { ...opts, powerups: { rate: 0 } });
  expect(Object.keys(blockStats([none.overworld]))).toEqual(["coin"]);

  const all = gen.generate(3, { ...opts, powerups: { rate: 1, minGap: 0, max: {} } });
  const stats = blockStats([all.overworld]);
  expect(stats.coin).toBeUndefined();
  expect(all.overworld.blocks![0].item).toBe("mushroom");
});

test("max per item and minGap are respected", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const l = gen.generate(seed, { ...opts, powerups: { rate: 1, minGap: 0, weights: { star: 1, flower: 1 }, max: { star: 1 } } });
    expect(blockStats([l.overworld]).star ?? 0).toBeLessThanOrEqual(1);
  }
  const l = gen.generate(2, { ...opts, powerups: { rate: 1, minGap: 30 } });
  const xs = l.overworld.blocks!.filter((b) => b.item !== "coin").map((b) => b.x);
  xs.slice(1).forEach((x, i) => expect(x - xs[i]).toBeGreaterThanOrEqual(30));
});

test("pinned blocks of a segment survive, shifted, and are not overwritten", () => {
  const pinned: Segment = { ...seg("p", [5]), blocks: [{ x: 5, y: 9, item: "frog" }] };
  const chain = new SegmentChain();
  chain.push(seg("a", [1]));
  chain.push(pinned);
  const { area } = chain.join();
  expect(area.blocks).toEqual([{ x: 21, y: 9, item: "frog" }]);

  fillSlots([area], new Rng(1), { rate: 1, minGap: 0 });
  expect(area.blocks).toHaveLength(2);
  expect(area.blocks!.find((b) => b.x === 21)!.item).toBe("frog");
});

test("a segment with a block item that is not on a ? is skipped by the library", () => {
  const bad: Segment = { ...seg("bad", [5]), blocks: [{ x: 6, y: 9, item: "frog" }] };
  const l = new SegmentLibrary([bad, seg("ok", [5])], [seg("s", [], ["start"]), seg("e", [], ["end"])]);
  expect(l.middles("normal").map((s) => s.name)).toEqual(["ok"]);
});
