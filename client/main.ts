/// <reference types="vite/client" />
import { createState, FPS, LevelGenerator, LevelSequence, loadLevel, SegmentLibrary, step, toFrame, type LevelType, type Segment } from "../core/index.ts";
import { readButtons, takeRestart } from "./input.ts";
import { connected, sendFrame } from "./net.ts";
import { camera, render } from "./render.ts";

const segments = import.meta.glob("../levels/{normal,castle,caves}/*.json", { eager: true, import: "default" });
const enclosures = import.meta.glob("../levels/enclosure/*.json", { eager: true, import: "default" });
const named = (files: Record<string, unknown>) =>
  Object.entries(files).map(([path, s]) => ({ ...(s as Segment), name: path.split("/").pop()!.replace(".json", "") }));

const allSegments = named(segments);
const lib = new SegmentLibrary(allSegments, named(enclosures));

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 1);
const typeParam = (params.get("type") ?? "normal") as LevelType;
const mapParam = params.get("map");

const specificSegment = mapParam ? allSegments.find((s) => s.name === mapParam) : undefined;
const levels = new LevelSequence(new LevelGenerator(lib), seed, { length: 200, types: [typeParam] });

let level = specificSegment
  ? loadLevel({ player: { x: 2, y: 10 }, ...specificSegment })
  : loadLevel(levels.next());
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
  if (state.status === "won") {
    if (specificSegment) {
      state = createState(level);
    } else {
      state = createState((level = loadLevel(levels.next())));
    }
  }

  while (acc >= FRAME_MS) {
    step(state, readButtons());
    sendFrame(toFrame(state));
    acc -= FRAME_MS;
  }

  const info = `${level.name}  frame ${state.frame}  server ${connected() ? "on" : "off"}`;
  render(ctx, state, camera(state), info);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
