import { expect, test } from "vitest";
import { Button, createState, loadLevel, step } from "../core/index.ts";

/** 30x15 map with a floor; `put` writes tile chars at (x, y). */
function level(put: [number, number, string][]) {
  const rows = Array.from({ length: 15 }, (_, y) => (y === 13 || y === 14 ? "#".repeat(30) : ".".repeat(30)).split(""));
  for (const [x, y, ch] of put) rows[y][x] = ch;
  return loadLevel({ name: "hazard", rows: rows.map((r) => r.join("")), enemies: [], player: { x: 2, y: 12 } });
}

const run = (state: ReturnType<typeof createState>, frames = 300) => {
  for (let i = 0; i < frames && state.status === "playing"; i++) step(state, Button.right | Button.run);
  return state;
};

test("lava kills on touch", () => {
  const state = run(createState(level([[8, 12, "L"]])));
  expect(state.status).toBe("dead");
  expect(state.player.x).toBeLessThan(10 * 16 * 16);
});

test("the same map without lava is passed to the right edge", () => {
  expect(run(createState(level([]))).status).toBe("won");
});

test("touching the flagpole ends the level", () => {
  const state = run(createState(level([6, 7, 8, 9, 10, 11, 12].map((y) => [12, y, "F"] as [number, number, string]))));
  expect(state.status).toBe("won");
  expect(state.player.right).toBeLessThan(29 * 16 * 16); // won at the pole, well before the right edge of the map
});
