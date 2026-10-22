import { expect, test } from "vitest";
import { Button, createState, loadLevel, step, SUB, TILE, TILE_SUB, type LevelFile } from "../core/index.ts";
import { Platform } from "../core/entities/platform.ts";

test("vertical platform moves down and reverses direction at range", () => {
  // start at 100px, range 32px, speed 1 px/frame (16 subpixels)
  const p = new Platform(1, 10 * TILE_SUB, 100 * SUB, 48, 8, "vertical", 32, 1, 1);
  expect(p.y).toBe(100 * SUB);
  expect(p.dir).toBe(1);

  // 32 frames moving down at 16 subpixels/frame = +512 subpixels = 32px
  for (let i = 0; i < 32; i++) {
    p.update();
  }
  expect(p.y).toBe((100 + 32) * SUB);
  expect(p.dir).toBe(-1);

  // Next frames move up
  p.update();
  expect(p.y).toBe((132 - 1) * SUB);
  expect(p.dir).toBe(-1);
});

test("player lands on a vertical moving platform and stays grounded", () => {
  const levelWithPlatform: LevelFile = {
    name: "plat-test",
    rows: [
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
    ],
    player: { x: 2, y: 1 },
    enemies: [],
    platforms: [
      { type: "vertical", x: 1, y: 3, w: 3, h: 0.5, range: 2, speed: 1, dir: 1 },
    ],
  };

  const state = createState(loadLevel(levelWithPlatform));
  expect(state.platforms.length).toBe(1);

  // Step until player falls onto the platform
  for (let i = 0; i < 20; i++) {
    step(state, 0);
  }

  const p = state.platforms[0];
  expect(state.player.onGround).toBe(true);
  expect(state.player.hit.ground).toBe(true);
  expect(state.player.y).toBe(p.y - state.player.h * SUB);
  expect(state.standingPlatform).toBe(p);
});

test("player riding a descending platform moves with it without detaching", () => {
  const levelWithPlatform: LevelFile = {
    name: "plat-descend",
    rows: [
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
    ],
    player: { x: 2, y: 2 },
    enemies: [],
    platforms: [
      { type: "vertical", x: 1, y: 3, w: 3, h: 0.5, range: 4, speed: 1, dir: 1 },
    ],
  };

  const state = createState(loadLevel(levelWithPlatform));
  const p = state.platforms[0];

  // Land on the platform
  for (let i = 0; i < 15; i++) {
    step(state, 0);
  }
  expect(state.standingPlatform).toBe(p);

  // Ride down for 20 frames
  for (let i = 0; i < 20; i++) {
    step(state, 0);
    expect(state.player.onGround).toBe(true);
    expect(state.player.y).toBe(p.y - state.player.h * SUB);
    expect(state.standingPlatform).toBe(p);
  }
});

test("player can jump off a moving platform", () => {
  const levelWithPlatform: LevelFile = {
    name: "plat-jump",
    rows: [
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
    ],
    player: { x: 2, y: 2 },
    enemies: [],
    platforms: [
      { type: "vertical", x: 1, y: 3, w: 3, h: 0.5, range: 2, speed: 1, dir: 1 },
    ],
  };

  const state = createState(loadLevel(levelWithPlatform));

  // Land on the platform
  for (let i = 0; i < 15; i++) {
    step(state, 0);
  }
  expect(state.player.onGround).toBe(true);

  // Jump off
  step(state, Button.jump);
  expect(state.player.vy).toBeLessThan(0);
  expect(state.player.onGround).toBe(false);
  expect(state.player.hit.ground).toBe(false);
  expect(state.standingPlatform).toBeNull();
});

test("player passes through platform from below when jumping up", () => {
  const levelWithPlatform: LevelFile = {
    name: "plat-jump-through",
    rows: [
      "..........",
      "..........",
      "..........",
      "..........",
      "##########",
    ],
    player: { x: 2, y: 3 },
    enemies: [],
    platforms: [
      { type: "vertical", x: 1, y: 2, w: 3, h: 0.5, range: 0, speed: 0 },
    ],
  };

  const state = createState(loadLevel(levelWithPlatform));
  for (let i = 0; i < 5; i++) step(state, 0);
  // Jump from floor below platform
  step(state, Button.jump);
  expect(state.player.vy).toBeLessThan(0);
  
  // Player rises through platform height without being blocked
  for (let i = 0; i < 5; i++) {
    step(state, Button.jump);
  }
  expect(state.player.y).toBeLessThan(state.platforms[0].y);
});

test("player riding horizontal platform moves along X", () => {
  const levelWithPlatform: LevelFile = {
    name: "plat-horiz",
    rows: [
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    player: { x: 2, y: 1 },
    enemies: [],
    platforms: [
      { type: "horizontal", x: 1, y: 2, w: 3, h: 0.5, range: 4, speed: 1, dir: 1 },
    ],
  };

  const state = createState(loadLevel(levelWithPlatform));
  for (let i = 0; i < 15; i++) step(state, 0);

  expect(state.player.onGround).toBe(true);
  const startPlayerX = state.player.x;

  for (let i = 0; i < 10; i++) step(state, 0);
  expect(state.player.x).toBeGreaterThan(startPlayerX);
});

test("horizontal platform oscillates right and left around startX", () => {
  // start at 100px, range 32px, speed 1 px/frame
  const p = new Platform(1, 100 * SUB, 10 * TILE_SUB, 48, 8, "horizontal", 32, 1, 1);
  expect(p.x).toBe(100 * SUB);
  expect(p.dir).toBe(1);

  // 32 frames moving right
  for (let i = 0; i < 32; i++) {
    p.update();
  }
  expect(p.x).toBe((100 + 32) * SUB);
  expect(p.dir).toBe(-1);

  // Next frames move left
  p.update();
  expect(p.x).toBe((132 - 1) * SUB);
  expect(p.dir).toBe(-1);
});

test("horizontal platform can start moving left (dir = -1)", () => {
  const p = new Platform(1, 100 * SUB, 10 * TILE_SUB, 48, 8, "horizontal", 32, 1, -1);
  expect(p.dir).toBe(-1);

  p.update();
  expect(p.x).toBe((100 - 1) * SUB);
  expect(p.vx).toBeLessThan(0);
});

test("player carried by horizontal platform does not clip into solid walls", () => {
  const levelWithWall: LevelFile = {
    name: "plat-wall",
    rows: [
      ".......#",
      ".......#",
      ".......#",
      ".......#",
    ],
    player: { x: 4, y: 1 },
    enemies: [],
    platforms: [
      // Platform moving right directly towards the wall at x=7
      { type: "horizontal", x: 3, y: 2, w: 3, h: 0.5, range: 4, speed: 2, dir: 1 },
    ],
  };

  const state = createState(loadLevel(levelWithWall));
  for (let i = 0; i < 15; i++) step(state, 0);
  expect(state.player.onGround).toBe(true);

  // Push player towards the wall
  for (let i = 0; i < 40; i++) step(state, 0);

  // Player must be stopped before the wall at x=7 tiles (7 * 16 * 16)
  expect(state.player.right).toBeLessThanOrEqual(7 * TILE_SUB);
});
