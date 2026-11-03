import { describe, expect, it } from "vitest";
import { createState, ENTITY_IDS, LevelGenerator, loadLevel, OBS, OBS_BYTES, step, Tile, writeObservation } from "../core/index.ts";
import { loadLibrary } from "../headless/tools/segmentFiles.ts";

const level = () => loadLevel(new LevelGenerator(loadLibrary()).generate(5, { length: 60, type: "normal" }));

describe("bot observation", () => {
  it("has the layout the Python side expects", () => {
    expect(OBS_BYTES).toBe(OBS.w * OBS.h * 2 + OBS.maxEnemies + 4 * (OBS.scalars + OBS.maxEnemies * OBS.enemyFloats));
    expect(Object.keys(ENTITY_IDS).length).toBeLessThan(OBS.slots);
  });

  it("shows ground under the player, walls left of the map and the power state", () => {
    const state = createState(level());
    for (let i = 0; i < 30; i++) step(state, 0); // land
    const buf = Buffer.alloc(OBS_BYTES);
    writeObservation(buf, 0, state);
    expect(buf[0 * OBS.w + 0]).toBe(Tile.hard); // outside the map on the left
    const column = Array.from({ length: OBS.h }, (_, y) => buf[y * OBS.w + OBS.behind]);
    expect(column).toContain(Tile.floor);
    const scalars = OBS.w * OBS.h * 2 + OBS.maxEnemies;
    expect(buf.readFloatLE(scalars + 8)).toBe(1); // on the ground
    expect(buf.readFloatLE(scalars + 20)).toBe(1); // small
  });

  it("is deterministic", () => {
    const a = Buffer.alloc(OBS_BYTES);
    const b = Buffer.alloc(OBS_BYTES);
    const [s1, s2] = [createState(level()), createState(level())];
    for (let i = 0; i < 100; i++) {
      step(s1, 2 | 8);
      step(s2, 2 | 8);
    }
    writeObservation(a, 0, s1);
    writeObservation(b, 0, s2);
    expect(a.equals(b)).toBe(true);
  });
});
