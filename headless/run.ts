// Runs the game in Node without graphics and measures speed.
// npm run headless [-- frames]

import { Button, createState, loadLevel, step, toFrame, type LevelFile } from "../core/index.ts";
import levelFile from "../levels/level1.json" with { type: "json" };

const frames = Number(process.argv[2] ?? 100_000);
const level = loadLevel(levelFile as LevelFile);
let state = createState(level);
let restarts = 0;

const t0 = performance.now();
for (let i = 0; i < frames; i++) {
  // simple scripted input: run right, jump every 40 frames
  const jump = i % 40 < 20 ? Button.jump : 0;
  step(state, Button.right | Button.run | jump);
  if (state.status !== "playing") {
    state = createState(level);
    restarts++;
  }
}
const ms = performance.now() - t0;

console.log(`${frames} frames in ${ms.toFixed(0)} ms -> ${Math.round(frames / (ms / 1000))} frames/s, ${restarts} restarts`);
console.log("last frame:", JSON.stringify(toFrame(state).player));
