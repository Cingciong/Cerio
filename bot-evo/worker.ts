// Headless environment worker for bot-evo. Python sends buttons, the worker plays and answers with observations.
// Frames on stdin/stdout: [u8 cmd][u32 len][payload]  ->  [u32 len][payload]
//   1 reset   JSON {seed, length, type, n, segment?, stallDecisions?, maxDecisions?}  -> n status bytes (1 = finished) + n observation records
//   2 step    n button bytes, held REPEAT frames -> same as reset
//   3 result                                    -> n * 6 f32: maxRight px, map width px, coins, won, frames, outcome (0 stall, 1 dead, 2 won)
//   0 quit

import { createState, LevelGenerator, loadLevel, mapPx, OBS_BYTES, step, SUB, writeObservation, type GameState, type LevelType } from "../core/index.ts";
import { loadLibrary } from "../headless/tools/segmentFiles.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPEAT = 4; // frames per decision
let stallLimit = 150; // decisions without new progress, set by reset
let maxDecisions = 3000;

interface Env {
  state: GameState;
  done: boolean;
  maxRight: number;
  stall: number;
  decisions: number;
  mapW: number;
}

const generator = new LevelGenerator(loadLibrary());
const levels = new Map<string, ReturnType<typeof loadLevel>>();
let envs: Env[] = [];

/** A hand-made map from levels/<normal|castle|caves>/<name>.json, same loading as ?map=<name> in the game. */
function segmentLevel(name: string) {
  const generated = name.startsWith("generated/"); // a whole level saved in levels/generated/
  const bare = generated ? name.slice("generated/".length) : name;
  if (!/^[\w.-]+$/.test(bare)) throw new Error(`bad map name: ${name}`);
  if (generated) {
    const file = join(import.meta.dirname, "..", "levels", "generated", `${bare}.json`);
    if (!existsSync(file)) throw new Error(`no generated level named ${bare}`);
    return loadLevel(JSON.parse(readFileSync(file, "utf8")));
  }
  for (const dir of ["normal", "castle", "caves"]) {
    const file = join(import.meta.dirname, "..", "levels", dir, `${name}.json`);
    if (existsSync(file)) {
      const seg = { ...JSON.parse(readFileSync(file, "utf8")), name };
      return loadLevel({ player: { x: 2, y: 10 }, ...seg, type: seg.theme });
    }
  }
  throw new Error(`no map named ${name}`);
}

function levelFor(seed: number, length: number, type: LevelType, segment?: string) {
  const key = segment ? `map:${segment}` : `${type}:${length}:${seed}`;
  let level = levels.get(key);
  if (!level) {
    if (levels.size > 64) levels.clear();
    level = segment ? segmentLevel(segment) : loadLevel(generator.generate(seed, { length, type }));
    levels.set(key, level);
  }
  return level;
}

function observations(): Buffer {
  const n = envs.length;
  const out = Buffer.alloc(n + n * OBS_BYTES);
  envs.forEach((e, i) => {
    out[i] = e.done ? 1 : 0;
    if (!e.done) writeObservation(out, n + i * OBS_BYTES, e.state);
  });
  return out;
}

function reset(seed: number, length: number, type: LevelType, n: number, segment?: string): Buffer {
  const level = levelFor(seed, length, type, segment);
  envs = Array.from({ length: n }, () => {
    const state = createState(level);
    return { state, done: false, maxRight: state.player.right / SUB, stall: 0, decisions: 0, mapW: mapPx(state) };
  });
  return observations();
}

function advance(buttons: Buffer): Buffer {
  envs.forEach((e, i) => {
    if (e.done) return;
    const s = e.state;
    for (let f = 0; f < REPEAT && s.status === "playing"; f++) step(s, buttons[i]);
    e.decisions++;
    const right = s.player.right / SUB;
    if (s.area === "overworld" && right > e.maxRight + 0.5) {
      e.maxRight = right;
      e.stall = 0;
    } else e.stall++;
    if (s.status !== "playing" || e.stall >= stallLimit || e.decisions >= maxDecisions) e.done = true;
  });
  return observations();
}

function results(): Buffer {
  const out = Buffer.alloc(envs.length * 24);
  envs.forEach((e, i) => {
    const won = e.state.status === "won";
    const values = [won ? e.mapW : e.maxRight, e.mapW, e.state.coins, won ? 1 : 0, e.state.frame, won ? 2 : e.state.status === "dead" ? 1 : 0];
    values.forEach((v, k) => out.writeFloatLE(v, i * 24 + k * 4));
  });
  return out;
}

function send(payload: Buffer): void {
  const head = Buffer.alloc(4);
  head.writeUInt32LE(payload.length);
  process.stdout.write(Buffer.concat([head, payload]));
}

function handle(cmd: number, payload: Buffer): void {
  if (cmd === 0) process.exit(0);
  if (cmd === 1) {
    const p = JSON.parse(payload.toString("utf8"));
    stallLimit = p.stallDecisions ?? 150;
    maxDecisions = p.maxDecisions ?? 3000;
    send(reset(p.seed, p.length, p.type ?? "normal", p.n, p.segment));
  } else if (cmd === 2) send(advance(payload));
  else if (cmd === 3) send(results());
}

let pending = Buffer.alloc(0);
process.stdin.on("data", (chunk: Buffer) => {
  pending = Buffer.concat([pending, chunk]);
  while (pending.length >= 5) {
    const len = pending.readUInt32LE(1);
    if (pending.length < 5 + len) break;
    const cmd = pending[0];
    const payload = pending.subarray(5, 5 + len);
    pending = pending.subarray(5 + len);
    handle(cmd, payload);
  }
});
process.stdin.on("end", () => process.exit(0));
