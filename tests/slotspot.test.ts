import { expect, test } from "vitest";
import { findSlotSpot, type Segment } from "../core/index.ts";

const flat = (patch: (rows: string[][]) => void = () => {}, extra: Partial<Segment> = {}): Segment => {
  const rows = Array.from({ length: 15 }, (_, y) => (y >= 13 ? "#".repeat(32) : ".".repeat(32)).split(""));
  patch(rows);
  return { name: "t", theme: "normal", rows: rows.map((r) => r.join("")), enemies: [], ...extra };
};

test("a spot is a lone block 4 tiles above flat ground, near the middle", () => {
  expect(findSlotSpot(flat())).toEqual({ x: 16, y: 9 });
});

test("no spot in segments that already have a ?, in end segments or without flat ground", () => {
  expect(findSlotSpot(flat((r) => (r[9][5] = "?")))).toBeUndefined();
  expect(findSlotSpot(flat(() => {}, { tags: ["end"] }))).toBeUndefined();
  expect(findSlotSpot(flat((r) => { r[13].fill("."); r[14].fill("."); }))).toBeUndefined();
});

test("spots avoid pipes and enemies", () => {
  const pipe = findSlotSpot(flat((r) => { r[11][16] = "<"; r[11][17] = ">"; r[12][16] = "["; r[12][17] = "]"; }));
  expect(Math.abs(pipe!.x - 16.5)).toBeGreaterThan(2);
  const enemy = findSlotSpot(flat(() => {}, { enemies: [{ type: "goomba", x: 16, y: 12 }] }));
  expect(Math.abs(enemy!.x - 16)).toBeGreaterThan(2);
});

test("a spot is never at the edge of a segment", () => {
  const s = flat();
  const spot = findSlotSpot({ ...s, rows: s.rows.map((r) => r.slice(0, 6)) });
  expect(spot).toBeUndefined();
});
