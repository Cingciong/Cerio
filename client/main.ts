/// <reference types="vite/client" />
import { createState, FPS, LevelGenerator, LevelSequence, loadLevel, SegmentLibrary, step, toFrame, type LevelType, type Segment } from "../core/index.ts";
import { flagCurrentSegment, flagDialogOpen } from "./flag.ts";
import { readButtons, takeFlag, takeRestart } from "./input.ts";
import { connected, sendFrame, latestReply } from "./net.ts";
import { camera, render } from "./render.ts";
import { playSounds } from "./sound.ts";

const segments = import.meta.glob("../levels/{normal,castle,caves}/*.json", { eager: true, import: "default" });
const enclosures = import.meta.glob("../levels/enclosure/*.json", { eager: true, import: "default" });
const named = (files: Record<string, unknown>) =>
  Object.entries(files).map(([path, s]) => ({ ...(s as Segment), name: path.split("/").pop()!.replace(".json", "") }));

const allSegments = named(segments);
const lib = new SegmentLibrary(allSegments, named(enclosures));
const segmentPaths = Object.fromEntries(Object.keys(segments).map((p) => [p.split("/").pop()!.replace(".json", ""), p.replace("../levels/", "")]));

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

const FRAMES_PER_DECISION = 4;

let botEnabled = false;

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "b") {
    botEnabled = !botEnabled;
    console.log("AI player:", botEnabled ? "ON" : "OFF");
  }
});

function loop(now: number): void {
  acc = Math.min(acc + now - last, 250);
  last = now;
  if (flagDialogOpen()) acc = 0; 

  if (takeRestart() || (botEnabled && state.status === "dead")) {
    state = createState(level);
  }
  if (takeFlag() && import.meta.env.DEV) flag();
  if (state.status === "won") {
    if (specificSegment) {
      state = createState(level);
    } else {
      state = createState((level = loadLevel(levels.next())));
    }
  }

  while (acc >= FRAME_MS) {
    const remote = latestReply();
    const playerButtons = (botEnabled && remote && remote.player != null) ? remote.player : readButtons();
    const enemyButtons = (remote && remote.enemies) ? remote.enemies : {};
    state.enemies.forEach(enemy => {
        enemy.setController((en) => {
            const action = enemyButtons[en.id];
            return action !== undefined ? action : undefined;
        });
    });

    step(state, playerButtons);
    playSounds(state.events);
    sendFrame(toFrame(state));

    if (connected() && state.frame % FRAMES_PER_DECISION === 0) {
        sendFrame(toFrame(state));
    }

    acc -= FRAME_MS;
  }

  const ring = state.redRings.find((r) => r.phase === "active");
  const red = ring ? `  red ${ring.collected.filter(Boolean).length}/${ring.coins.length} ${Math.ceil(ring.timer / FPS)}s` : "";
  const info = `${level.name}  coins ${state.coins}${red}  frame ${state.frame}  server ${connected() ? "on" : "off"}`;
  render(ctx, state, camera(state), info);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
