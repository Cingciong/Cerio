import { expect, test } from "vitest";
import { Button, createState, loadLevel, step, TILE_SUB, type LevelFile } from "../core/index.ts";

// 6 tiles wide, 3 tiles high: the only limits are the map edges left/right.
const tiny: LevelFile = { name: "tiny", rows: ["......", "......", "######"], player: { x: 1, y: 1 }, enemies: [] };

test("player can jump above the top of the map", () => {
  const state = createState(loadLevel(tiny));
  for (let i = 0; i < 5; i++) step(state, 0);
  for (let i = 0; i < 20; i++) step(state, Button.jump);
  expect(state.player.y).toBeLessThan(0);
});

test("left edge of the map is a wall", () => {
  const state = createState(loadLevel(tiny));
  for (let i = 0; i < 120; i++) step(state, Button.left);
  expect(state.player.x).toBe(0);
});

test("touching the right edge of the map wins", () => {
  const state = createState(loadLevel(tiny));
  for (let i = 0; i < 300 && state.status === "playing"; i++) step(state, Button.right);
  expect(state.status).toBe("won");
  expect(state.player.right).toBe(6 * TILE_SUB);
});
