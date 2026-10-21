/// <reference types="vite/client" />
import { createState, FPS, loadLevel, step, toFrame, type LevelFile } from "../core/index.ts";
import levelFile from "../levels/seg1-1-3.json";
import { generate, type Segment } from "../core/index.ts";
import { readButtons, takeRestart } from "./input.ts";
import { connected, sendFrame } from "./net.ts";
import { camera, render } from "./render.ts";

const files = import.meta.glob("../levels/**/seg*.json", { eager: true, import: "default" });
const segments = Object.values(files) as Segment[];
const seed = Number(new URLSearchParams(location.search).get("seed") ?? 1);
const level = loadLevel(generate(segments, seed, { length: 200, maxDifficulty: 5, themes: ["overworld"] }));let state = createState(level);

const ctx = (document.getElementById("game") as HTMLCanvasElement).getContext("2d")!;
const FRAME_MS = 1000 / FPS;
let last = performance.now();
let acc = 0;

// Fixed 60 Hz simulation, rendering at the display rate.
function loop(now: number): void {
  acc = Math.min(acc + now - last, 250);
  last = now;

  if (takeRestart()) state = createState(level);

  while (acc >= FRAME_MS) {
    step(state, readButtons());
    sendFrame(toFrame(state));
    acc -= FRAME_MS;
  }

  const ring = state.redRings.find((r) => r.phase === "active");
  const red = ring ? `red${ring.collected.filter(Boolean).length}/${ring.coins.length} ${Math.ceil(ring.timer/FPS)}s : ""`;
  const info =  `coins ${state.coins} frame ${state.frame}  server ${connected() ? "on" : "off"}`;
  render(ctx, state, camera(state), info);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
