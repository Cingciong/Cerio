import { createState, FPS, loadLevel, step, toFrame, type LevelFile } from "../core/index.ts";
import levelFile from "../levels/level2.json";
import { readButtons, takeRestart } from "./input.ts";
import { connected, sendFrame } from "./net.ts";
import { camera, render } from "./render.ts";

const level = loadLevel(levelFile as LevelFile);
let state = createState(level);

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

  const info = `frame ${state.frame}  server ${connected() ? "on" : "off"}`;
  render(ctx, state, camera(state), info);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
