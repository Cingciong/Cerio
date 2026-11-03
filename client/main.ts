/// <reference types="vite/client" />
import { createState, FPS, LevelGenerator, LevelSequence, loadLevel, SegmentLibrary, step, toFrame, type Level, type LevelType, type Segment } from "../core/index.ts";
import { flagCurrentSegment, flagDialogOpen } from "./flag.ts";
import { readButtons, takeFlag, takeRestart } from "./input.ts";
import { connected, sendFrame, latestReply } from "./net.ts";
import { camera, render } from "./render.ts";
import { playSounds } from "./sound.ts";
import { ReplayPlayer, type ReplayLevel } from "./replay.ts";
import { initBotMenu, type LaunchSpec } from "./botmenu.ts";

const segments = import.meta.glob("../levels/{normal,castle,caves}/*.json", { eager: true, import: "default" });
const enclosures = import.meta.glob("../levels/enclosure/*.json", { eager: true, import: "default" });
const generated = import.meta.glob("../levels/generated/*.json", { eager: true, import: "default" }); // whole levels, e.g. from npm run export-level
const fileName = (path: string) => path.split("/").pop()!.replace(".json", "");
const named = (files: Record<string, unknown>) => Object.entries(files).map(([path, s]) => ({ ...(s as Segment), name: fileName(path) }));

const allSegments = named(segments);
const lib = new SegmentLibrary(allSegments, named(enclosures));
const generator = new LevelGenerator(lib);
const segmentPaths = Object.fromEntries(Object.keys(segments).map((p) => [fileName(p), p.replace("../levels/", "")]));
const segmentList = Object.keys(segments).map((p) => ({ name: fileName(p), folder: p.split("/").slice(-2, -1)[0] }));
const generatedNames = Object.keys(generated).map(fileName).sort();

const spawn = { player: { x: 2, y: 10 } };
const generatedLevel = (name: string): Level => loadLevel(generated[`../levels/generated/${name}.json`] as Parameters<typeof loadLevel>[0]);
const segmentLevel = (seg: Segment): Level => loadLevel({ ...spawn, ...seg, type: seg.theme });
/** The level of a bot replay: a map file, a saved generated level, or a seed. */
const levelOf = (l: ReplayLevel): Level =>
  l.segment?.startsWith("generated/") ? generatedLevel(l.segment.slice("generated/".length))
  : l.segment ? segmentLevel(allSegments.find((s) => s.name === l.segment)!)
  : loadLevel(generator.generate(l.seed, { length: l.length, type: l.type as LevelType }));

const DEFAULT_SPEC: LaunchSpec = { kind: "random", seed: 1, length: 200, type: "normal" };

let levels: LevelSequence;
let level: Level;
let state: ReturnType<typeof createState> = undefined as never; // set by the first launch()
let fixedLevel = false; // a single map: restart it after winning instead of moving on to the next seed
let replay: ReplayPlayer | null = null;
let current: { label: string; spec: LaunchSpec } = { label: "", spec: DEFAULT_SPEC };

/** Starts a level (random by seed, a map file, a saved generated level) or the replay of a bot. Returns an error text, or null. */
function launch(spec: LaunchSpec): string | null {
  try {
    if (spec.kind === "human") return launch(DEFAULT_SPEC);
    const url = new URLSearchParams();
    let label: string;
    replay = null;
    fixedLevel = false;

    if (spec.kind === "watch" || spec.kind === "replay") {
      if (!state) {
        levels = new LevelSequence(generator, 1, { length: 200, types: ["normal"] });
        level = loadLevel(levels.next());
        state = createState(level);
      }
      if (spec.kind === "replay") {
        replay = new ReplayPlayer("", null, levelOf, { data: spec.data, title: spec.title });
        label = spec.title;
      } else {
        replay = new ReplayPlayer(spec.run, spec.gen ?? null, levelOf);
        label = `bot: ${spec.run}${spec.gen ? ` (${spec.gen})` : ""}`;
        url.set("watch", spec.run);
        if (spec.gen) url.set("gen", spec.gen);
      }
    } else {
      if (spec.kind === "random") {
        levels = new LevelSequence(generator, spec.seed, { length: spec.length, types: [spec.type as LevelType] });
        level = loadLevel(levels.next());
        label = `level: ${spec.seed}`;
        url.set("seed", String(spec.seed));
        url.set("type", spec.type);
        url.set("length", String(spec.length));
      } else if (spec.kind === "generated") {
        if (!generatedNames.includes(spec.name)) return `Nie ma zapisanego poziomu „${spec.name}” w levels/generated/.`;
        level = generatedLevel(spec.name);
        fixedLevel = true;
        label = `poziom: ${spec.name}`;
        url.set("generated", spec.name);
      } else {
        const seg = allSegments.find((s) => s.name === spec.name);
        if (!seg) return `Nie ma mapy „${spec.name}”.`;
        level = segmentLevel(seg);
        fixedLevel = true;
        label = `segment: ${spec.name}`;
        url.set("map", spec.name);
      }
      state = createState(level);
    }
    current = { label, spec };
    history.replaceState(null, "", url.size ? `?${url}` : location.pathname);
    return null;
  } catch (e) {
    return `Nie udało się: ${(e as Error).message}`;
  }
}

function startFromUrl(): void {
  const p = new URLSearchParams(location.search);
  const watch = p.get("watch");
  const map = p.get("map");
  const saved = p.get("generated");
  const spec: LaunchSpec =
    watch !== null ? { kind: "watch", run: watch, gen: p.get("gen") ?? undefined }
    : saved ? { kind: "generated", name: saved }
    : map ? { kind: "segment", name: map }
    : { kind: "random", seed: Number(p.get("seed") ?? 1), length: Number(p.get("length") ?? 200), type: p.get("type") ?? "normal" };
  if (launch(spec)) launch(DEFAULT_SPEC);
}
startFromUrl();

const ctx = (document.getElementById("game") as HTMLCanvasElement).getContext("2d")!;

const flagButton = document.getElementById("flag") as HTMLButtonElement;
const flagStatus = document.getElementById("flag-status")!;
flagButton.hidden = !import.meta.env.DEV;
async function flag(): Promise<void> {
  flagButton.blur(); // Space would press it again
  flagStatus.textContent = await flagCurrentSegment(state, segmentPaths);
}
flagButton.addEventListener("click", flag);

initBotMenu({
  types: generator.mainTypes(),
  segments: segmentList.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name)),
  generated: generatedNames,
  launch,
  current: () => current,
});

const FRAME_MS = 1000 / FPS;
let last = performance.now();
let acc = 0;

const FRAMES_PER_DECISION = 4;

let botEnabled = false;

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
  if (e.key.toLowerCase() === "b") {
    botEnabled = !botEnabled;
    console.log("AI player:", botEnabled ? "ON" : "OFF");
  }
});

function loop(now: number): void {
  acc = Math.min(acc + now - last, 250);
  last = now;
  if (flagDialogOpen()) acc = 0;

  if (!replay && (takeRestart() || (botEnabled && state.status === "dead"))) {
    state = createState(level);
  }
  if (takeFlag() && import.meta.env.DEV) flag();
  if (!replay && state.status === "won") {
    if (fixedLevel) {
      state = createState(level);
    } else {
      state = createState((level = loadLevel(levels.next())));
    }
  }

  while (acc >= FRAME_MS) {
    const rp = replay?.tick(state);
    if (rp?.level) {
      level = rp.level;
      state = createState(level);
    }
    const remote = latestReply();
    const playerButtons = rp ? rp.buttons : (botEnabled && remote && remote.player != null) ? remote.player : readButtons();
    const enemyButtons = (remote && remote.enemies) ? remote.enemies : {};
    state.enemies.forEach(enemy => {
        enemy.setController((en) => {
            const action = enemyButtons[en.id];
            return action !== undefined ? action : undefined;
        });
    });

    if (!rp?.frozen) step(state, playerButtons);
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
  render(ctx, state, camera(state), replay ? `${replay.label()}  coins ${state.coins}` : info);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
