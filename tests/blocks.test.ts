import { expect, test } from "vitest";
import { Button, createState, loadLevel, step, SUB, Tile, TILE_SUB, tileAt, type GameState, type LevelFile } from "../core/index.ts";

// Player stands at x=3 under a block row 3 tiles above the head.
function level(blockRow: string, enemies: LevelFile["enemies"] = []): GameState {
  const rows = [...Array(8).fill("........"), blockRow, "........", "........", "........", "........", "########", "########"];
  return createState(loadLevel({ name: "blocks", rows, player: { x: 3, y: 12 }, enemies }));
}

function jump(state: GameState, frames = 40): void {
  for (let i = 0; i < 3; i++) step(state, 0);
  for (let i = 0; i < frames; i++) step(state, Button.jump);
}

test("jumping into a brick breaks it and throws 4 pieces", () => {
  const state = level("...B....");
  jump(state, 20);
  expect(tileAt(state.map, 3, 8)).toBe(Tile.air);
  expect(state.debris).toHaveLength(4);
});

test("hard and used blocks only bump: they stay and send a bump event", () => {
  for (const ch of ["H", "u", "C", "S", "V"]) {
    const state = level(`...${ch}....`);
    const events: string[] = [];
    for (let i = 0; i < 3; i++) step(state, 0);
    for (let i = 0; i < 20; i++) {
      step(state, Button.jump);
      events.push(...state.events.map((e) => e.type));
      if (state.bumps.length) break;
    }
    expect(state.bumps).toHaveLength(1);
    expect(events).toEqual(["blockBump"]);
    jump(state);
    expect(tileAt(state.map, 3, 8)).not.toBe(Tile.air);
  }
});

test("only the block closest to the player's centre is hit", () => {
  const state = level("..BB....");
  state.player.x = 2 * TILE_SUB + 12 * SUB; // px 44..56: under tiles 2 and 3, centre (50) in tile 3
  jump(state, 20);
  expect(tileAt(state.map, 2, 8)).toBe(Tile.brick);
  expect(tileAt(state.map, 3, 8)).toBe(Tile.air);
});

test("an enemy standing on the hit block dies", () => {
  const state = level("...B....", [{ type: "goomba", x: 3, y: 7 }]);
  for (let i = 0; i < 3; i++) step(state, 0);
  const goomba = state.enemies[0];
  goomba.vx = 0;
  jump(state, 20);
  expect(goomba.alive).toBe(false);
});

test("restart gets the block back", () => {
  const state = level("...B....");
  jump(state, 20);
  expect(createState(state.level).map.tiles).not.toEqual(state.map.tiles);
  expect(tileAt(createState(state.level).map, 3, 8)).toBe(Tile.brick);
});
