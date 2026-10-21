import { expect, test } from "vitest";
import { Button, createState, LevelGenerator, loadLevel, PiranhaPlant, pipeChance, step, SUB, TILE_SUB, type GameState, type GeneratedLevel } from "../core/index.ts";
import { loadLibrary } from "../headless/tools/segmentFiles.ts";

const gen = new LevelGenerator(loadLibrary());
const levels = Array.from({ length: 200 }, (_, seed) => gen.generate(seed, { length: 200, type: "normal" }));
const withCave = levels.filter((l) => l.cave);

const entries = (l: GeneratedLevel, area: string) => l.pipes.filter((p) => p.area === area && p.kind === "entry");
const exits = (l: GeneratedLevel, area: string) => l.pipes.filter((p) => p.area === area && p.kind === "exit");
const segmentOf = (l: GeneratedLevel, x: number) => l.overworld.segments!.findIndex((s) => x >= s.x && x < s.x + s.w);

test("pipe chance is an inverted Gaussian", () => {
  expect(pipeChance(0.5)).toBe(0);
  expect(pipeChance(0)).toBeGreaterThan(0.9);
  expect(pipeChance(1)).toBeCloseTo(pipeChance(0));
});

test("about half of the levels have a cave", () => {
  expect(withCave.length / levels.length).toBeGreaterThan(0.35);
  expect(withCave.length / levels.length).toBeLessThan(0.65);
});

test("without a cave every pipe is plain", () => {
  for (const l of levels.filter((l) => !l.cave)) expect(l.pipes.every((p) => p.kind === "plain")).toBe(true);
});

test("entries sit in one segment in the first half, the single exit in a later segment in the second half", () => {
  for (const l of withCave) {
    const ins = entries(l, "overworld");
    const [out] = exits(l, "overworld");
    const width = l.overworld.rows[0].length;
    expect(ins.length).toBeGreaterThan(0);
    expect(exits(l, "overworld")).toHaveLength(1);
    expect(new Set(ins.map((p) => segmentOf(l, p.x))).size).toBe(1);
    expect(segmentOf(l, out.x)).toBeGreaterThan(segmentOf(l, ins[0].x));
    expect(ins[0].x).toBeLessThan(width * 0.6);
    expect(out.x).toBeGreaterThan(width * 0.4);
  }
});

test("pipes link overworld -> cave -> exit", () => {
  for (const l of withCave) {
    for (const p of entries(l, "overworld")) expect(l.pipes[p.to!]).toMatchObject({ area: "cave", kind: "exit" });
    const [back] = entries(l, "cave");
    expect(l.pipes[back.to!]).toMatchObject({ area: "overworld", kind: "exit" });
  }
});

/** Put the player standing on pipe `i`, centred. */
function standOn(state: GameState, i: number): void {
  const p = state.level.pipes[i];
  state.player.x = p.x * TILE_SUB + 10 * SUB;
  state.player.y = p.y * TILE_SUB - state.player.h * SUB;
}

function run(state: GameState, buttons: number, frames: number): void {
  for (let i = 0; i < frames; i++) step(state, buttons);
}

test("down on an entry pipe leads into the cave, jumping into the ceiling pipe leads to the exit pipe", () => {
  const file = withCave[0];
  const state = createState(loadLevel(file));
  const pipes = state.level.pipes;

  standOn(state, pipes.indexOf(entries(file, "overworld")[0]));
  run(state, 0, 2);
  run(state, Button.down, 40);
  expect(state.area).toBe("cave");
  run(state, 0, 120); // fall to the cave floor

  const back = entries(file, "cave")[0];
  state.player.x = back.x * TILE_SUB + 10 * SUB;
  run(state, 0, 30);
  run(state, Button.jump, 60);
  expect(state.area).toBe("overworld");
  run(state, 0, 40);
  expect(state.pipe).toBeUndefined();
  expect(state.player.bottom).toBe(pipes[back.to!].y * TILE_SUB); // standing on top of the exit pipe
});

test("a piranha on the exit pipe hides when the player comes out and stays hidden", () => {
  const file = structuredClone(withCave[0]);
  const out = exits(file, "overworld")[0];
  file.overworld.enemies.push({ type: "piranha", x: out.x, y: out.y - 1 });
  const state = createState(loadLevel(file));
  const plant = state.areaEnemies.overworld.at(-1) as PiranhaPlant; // the one added above
  expect(plant).toBeInstanceOf(PiranhaPlant);
  plant.phase = "up";
  plant.y = plant.topY;

  standOn(state, state.level.pipes.indexOf(entries(file, "overworld")[0]));
  run(state, 0, 2);
  run(state, Button.down, 40);
  run(state, 0, 120);
  const back = entries(file, "cave")[0];
  state.player.x = back.x * TILE_SUB + 10 * SUB;
  run(state, 0, 30);
  run(state, Button.jump, 40);
  expect(state.area).toBe("overworld");
  expect(plant.phase).toBe("hidden");

  run(state, 0, 300); // standing on the pipe
  expect(state.player.alive).toBe(true);
  expect(plant.phase).toBe("hidden");
});

test("exit and plain pipes cannot be entered", () => {
  for (const kind of ["exit", "plain"]) {
    const file = withCave.find((l) => l.pipes.some((p) => p.area === "overworld" && p.kind === kind && p.opens === "up"));
    if (!file) continue;
    const state = createState(loadLevel(file));
    standOn(state, file.pipes.findIndex((p) => p.area === "overworld" && p.kind === kind && p.opens === "up"));
    run(state, 0, 2);
    run(state, Button.down, 40);
    expect(state.area).toBe("overworld");
    expect(state.pipe).toBeUndefined();
  }
});
