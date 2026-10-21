import { expect, test } from "vitest";
import { Button, createState, LevelGenerator, loadLevel, step, toFrame } from "../core/index.ts";
import { loadLibrary } from "../headless/tools/segmentFiles.ts";

const levelFile = new LevelGenerator(loadLibrary()).generate(1, { length: 200, type: "normal" });

function play(): string {
  const state = createState(loadLevel(levelFile));
  for (let i = 0; i < 2000 && state.status === "playing"; i++) {
    const jump = i % 37 < 15 ? Button.jump : 0;
    step(state, Button.right | (i % 3 ? Button.run : 0) | jump);
  }
  return JSON.stringify(toFrame(state));
}

test("same inputs give the same state", () => {
  expect(play()).toBe(play());
});

test("player stands on the ground and can jump", () => {
  const state = createState(loadLevel(levelFile));
  for (let i = 0; i < 10; i++) step(state, 0);
  expect(state.player.onGround).toBe(true);
  const y = state.player.y;
  for (let i = 0; i < 15; i++) step(state, Button.jump);
  expect(state.player.y).toBeLessThan(y);
});
