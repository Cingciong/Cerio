/// <reference types="vite/client" />
import { createState, FPS, LevelGenerator, LevelSequence, loadLevel, SegmentLibrary, step, toFrame, type Segment } from "../core/index.ts";
import { flagCurrentSegment, flagDialogOpen } from "./flag.ts";
import { readButtons, takeFlag, takeRestart } from "./input.ts";
import { connected, sendFrame } from "./net.ts";
import { camera, render } from "./render.ts";
import { playSounds } from "./sound.ts";



const segments = import.meta.glob("../levels/{normal,castle,caves}/*.json", { eager: true, import: "default" });
const enclosures = import.meta.glob("../levels/enclosure/*.json", { eager: true, import: "default" });
const named = (files: Record<string, unknown>) =>
  Object.entries(files).map(([path, s]) => ({ ...(s as Segment), name: path.split("/").pop()!.replace(".json", "") }));
const lib = new SegmentLibrary(named(segments), named(enclosures));
const segmentPaths = Object.fromEntries(Object.keys(segments).map((p) => [p.split("/").pop()!.replace(".json", ""), p.replace("../levels/", "")]));
const seed = Number(new URLSearchParams(location.search).get("seed") ?? 1);
const levels = new LevelSequence(new LevelGenerator(lib), seed, { length: 200, types: ["normal"] });

let level = loadLevel(levels.next());
let state = createState(level);

const ctx = (document.getElementById("game") as HTMLCanvasElement).getContext("2d")!;

const flagButton = document.getElementById("flag") as HTMLButtonElement;
const flagStatus = document.getElementById("flag-status")!;
flagButton.hidden = !import.meta.env.DEV;
async function flag(): Promise<void> {
  flagButton.blur(); // Space would press it again
  flagStatus.textContent = await flagCurrentSegment(state, segmentPaths);
}
flagButton.addEventListener("click", flag);
const FRAME_MS = 1000 / FPS;
let last = performance.now();
let acc = 0;


function loop(now: number): void {
  acc = Math.min(acc + now - last, 250);
  last = now;
  if (flagDialogOpen()) acc = 0; 

  if (takeRestart()) state = createState(level);
  if (takeFlag() && import.meta.env.DEV) flag();
  if (state.status === "won") state = createState((level = loadLevel(levels.next())));

  while (acc >= FRAME_MS) {
    step(state, readButtons());
    playSounds(state.events);
    sendFrame(toFrame(state));
    acc -= FRAME_MS;
  }

  const info = `${level.name}  frame ${state.frame}  server ${connected() ? "on" : "off"}`;
  render(ctx, state, camera(state), info);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
