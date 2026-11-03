// Replays a bot-evo replay file in Node and compares progress with what training recorded (determinism check).
// node bot-evo/verifyReplay.ts bot-evo/runs/<run>/latest.json

import { readFileSync } from "node:fs";
import { createState, LevelGenerator, loadLevel, mapPx, step, SUB, type LevelType } from "../core/index.ts";
import { loadLibrary } from "../headless/tools/segmentFiles.ts";

const replay = JSON.parse(readFileSync(process.argv[2], "utf8"));
const generator = new LevelGenerator(loadLibrary());
let bad = 0;
for (const l of replay.levels) {
  const state = createState(loadLevel(generator.generate(l.seed, { length: l.length, type: l.type as LevelType })));
  let maxRight = state.player.right / SUB;
  while (state.status === "playing" && state.frame < l.actions.length * replay.repeat) {
    step(state, l.actions[Math.floor(state.frame / replay.repeat)] ?? 0);
    if (state.area === "overworld") maxRight = Math.max(maxRight, state.player.right / SUB);
  }
  const progress = state.status === "won" ? 1 : Math.min(1, maxRight / mapPx(state));
  const ok = Math.abs(progress - l.progress) < 1e-3 && state.coins === l.coins;
  if (!ok) bad++;
  console.log(`seed ${l.seed}: recorded ${l.progress.toFixed(4)} replayed ${progress.toFixed(4)} coins ${l.coins}/${state.coins} ${ok ? "MATCH" : "MISMATCH"}`);
}
process.exit(bad ? 1 : 0);
