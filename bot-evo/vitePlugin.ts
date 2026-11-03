// Dev server API for the game menu (Bot-evo): lists models, serves replays, edits settings, starts and stops training.
//   GET  /__bot/runs.json  /models.json  /schema.json  /status.json  /log/<run>  /<run>/config.json  /<run>/latest.json  /<run>/replays/gen_0007.json
//   POST /__bot/train {run, resume, config}   /stop {run}   /config {run, config}
// Python used for training: bot-evo/local.json {"python": "..."} (git-ignored), else env BOT_EVO_PYTHON, else "python".

import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, normalize } from "node:path";
import type { Plugin } from "vite";
import { LevelGenerator, type LevelType } from "../core/index.ts";
import { loadLibrary } from "../headless/tools/segmentFiles.ts";

const HERE = import.meta.dirname;
const RUNS = join(HERE, "runs");
const GENERATED = join(HERE, "..", "levels", "generated"); // whole generated levels, also written by npm run export-level
const ALIVE_S = 45; // a run counts as running while its heartbeat is newer than this
const STARTUP_MS = 90_000; // time for python to import torch before the first heartbeat

const starting = new Map<string, number>();
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const readJson = (path: string, fallback: unknown = {}) => (existsSync(path) ? json(path) : fallback);
const validName = (s: unknown): s is string => typeof s === "string" && /^[\w-]{1,40}$/.test(s);

function pythonPath(): string {
  const local = readJson(join(HERE, "local.json")) as { python?: string };
  return local.python ?? process.env.BOT_EVO_PYTHON ?? "python";
}

function defaultsOf(): { evolution: Record<string, any>; score: Record<string, any> } {
  return json(join(HERE, "defaults.json"));
}

function configOf(run: string) {
  const schema = defaultsOf();
  const saved = readJson(join(RUNS, run, "config.json")) as Record<string, Record<string, unknown>>;
  const out: Record<string, Record<string, unknown>> = {};
  for (const g of Object.keys(schema) as (keyof typeof schema)[]) {
    out[g] = {};
    for (const [k, v] of Object.entries(schema[g])) out[g][k] = saved[g]?.[k] ?? v.value;
  }
  return out;
}

function heartbeat(run: string): { gen: number; fresh: boolean } | null {
  const hb = readJson(join(RUNS, run, "running.json"), null) as { gen: number; time: number } | null;
  if (!hb) return null;
  return { gen: hb.gen, fresh: Date.now() / 1000 - hb.time < ALIVE_S };
}

function isRunning(run: string): boolean {
  if (heartbeat(run)?.fresh) return true;
  const t = starting.get(run);
  return t !== undefined && Date.now() - t < STARTUP_MS;
}

/** Runs from before run.json existed: best score = max of the "best" column in log.csv. */
function bestFromLog(dir: string): number | null {
  const path = join(dir, "log.csv");
  if (!existsSync(path)) return null;
  const best = readFileSync(path, "utf8").split(/\r?\n/).slice(1).map((l) => Number(l.split(",")[2])).filter((n) => !Number.isNaN(n));
  return best.length ? Math.max(...best) : null;
}

function summary(run: string) {
  const dir = join(RUNS, run);
  const meta = readJson(join(dir, "run.json"), null) as Record<string, unknown> | null;
  const latest = readJson(join(dir, "latest.json"), null) as { gen: number; score: number; levels: { length: number }[] } | null;
  const replays = existsSync(join(dir, "replays")) ? readdirSync(join(dir, "replays")).length : 0;
  const base = meta ?? {
    name: run,
    created: statSync(dir).birthtime.toISOString(),
    updated: latest ? statSync(join(dir, "latest.json")).mtime.toISOString() : null,
    generations: replays,
    best: bestFromLog(dir) ?? latest?.score ?? null,
    length: latest?.levels[0]?.length ?? null,
  };
  const hb = heartbeat(run);
  const hasVal = existsSync(join(dir, "best_val_replay.json"));
  return { ...base, hasVal, running: isRunning(run) || (!meta && latest !== null && Date.now() - statSync(join(dir, "latest.json")).mtimeMs < 20_000), gen: hb?.gen };
}

function listRuns(): string[] {
  const runs = existsSync(RUNS) ? readdirSync(RUNS).filter((r) => statSync(join(RUNS, r)).isDirectory()) : [];
  return runs.sort((a, b) => statSync(join(RUNS, b)).mtimeMs - statSync(join(RUNS, a)).mtimeMs);
}

function tail(path: string, n = 25): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l && !/warn/i.test(l)).slice(-n);
}

function body(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function reply(res: ServerResponse, data: unknown, status = 200): void {
  res.statusCode = status;
  res.end(typeof data === "string" ? data : JSON.stringify(data));
}

function startTraining(run: string, resume: boolean): void {
  const dir = join(RUNS, run);
  mkdirSync(dir, { recursive: true });
  const out = openSync(join(dir, "train.log"), "a");
  const args = [join(HERE, "train.py"), "--run", run, ...(resume ? ["--resume"] : [])];
  const child = spawn(pythonPath(), args, {
    cwd: join(HERE, ".."),
    detached: true,
    windowsHide: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
  });
  child.on("error", (e) => writeFileSync(join(dir, "train.log"), `cannot start ${pythonPath()}: ${e.message}\n`, { flag: "a" }));
  child.on("exit", () => starting.delete(run));
  void ensureTensorboard();
  child.unref();
  starting.set(run, Date.now());
}

const TB_PORT = 6006;
let tbStarted = 0;

async function tensorboardUp(): Promise<boolean> {
  try {
    return (await fetch(`http://127.0.0.1:${TB_PORT}/tensorboard/`, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}

/** TensorBoard of all runs, served by vite at /tensorboard/ (proxy in vite.config.ts). Started once, keeps running. */
async function ensureTensorboard(): Promise<void> {
  if (Date.now() - tbStarted < 40_000 || (await tensorboardUp())) return;
  tbStarted = Date.now();
  mkdirSync(RUNS, { recursive: true });
  const log = openSync(join(RUNS, "tensorboard.log"), "a");
  const args = ["-m", "tensorboard.main", "--logdir", RUNS, "--host", "127.0.0.1", "--port", String(TB_PORT), "--path_prefix", "/tensorboard", "--reload_interval", "5"];
  spawn(pythonPath(), args, { detached: true, windowsHide: true, stdio: ["ignore", log, log] }).unref();
}

let playing = false;
let ranking = false;

/** Every saved bot plays the same fixed levels (bot-evo/rank.py); writes runs/ranking.json. */
async function rank(res: ServerResponse): Promise<void> {
  if (ranking) return reply(res, { error: "Ranking już się liczy." }, 409);
  ranking = true;
  try {
    await new Promise<void>((resolve, reject) =>
      execFile(pythonPath(), [join(HERE, "rank.py")], { cwd: join(HERE, ".."), timeout: 600_000, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }, (err, _out, stderr) =>
        err ? reject(new Error(stderr.split(/\r?\n/).filter((l) => l && !/warn/i.test(l)).slice(-2).join(" ") || err.message)) : resolve()));
    reply(res, readFileSync(join(RUNS, "ranking.json"), "utf8"));
  } catch (e) {
    reply(res, { error: `Nie udało się policzyć rankingu: ${(e as Error).message}` }, 500);
  } finally {
    ranking = false;
  }
}

/** One saved genome plays one chosen level (bot-evo/play.py, CPU, one worker); answers with the replay. */
async function play(res: ServerResponse, b: any): Promise<void> {
  const dir = join(RUNS, b.run);
  const which = b.genome === "gen" || b.genome === "val" ? b.genome : existsSync(join(dir, "best_val.pt")) ? "val" : "gen"; // the validated bot if there is one
  if (!existsSync(join(dir, which === "val" ? "best_val.pt" : "best_gen.pt"))) return reply(res, { error: "Ten model nie ma jeszcze zapisanego bota." }, 400);
  if (playing) return reply(res, { error: "Poprzednie liczenie jeszcze trwa." }, 409);
  const args = [join(HERE, "play.py"), "--run", b.run, "--genome", which, "--out", join(dir, "play.json")];
  if (typeof b.segment === "string" && /^[\w./-]{1,100}$/.test(b.segment) && !b.segment.includes("..")) args.push("--segment", b.segment);
  else args.push("--seed", String(Math.trunc(Number(b.seed) || 1)), "--length", String(Math.trunc(Number(b.length) || 120)), "--type", /^\w+$/.test(String(b.type)) ? String(b.type) : "normal");
  playing = true;
  try {
    await new Promise<void>((resolve, reject) =>
      execFile(pythonPath(), args, { cwd: join(HERE, ".."), timeout: 90_000, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }, (err, _out, stderr) =>
        err ? reject(new Error(stderr.split(/\r?\n/).filter((l) => l && !/warn/i.test(l)).slice(-2).join(" ") || err.message)) : resolve()));
    reply(res, readFileSync(join(dir, "play.json"), "utf8"));
  } catch (e) {
    reply(res, { error: `Nie udało się policzyć: ${(e as Error).message}` }, 500);
  } finally {
    playing = false;
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-type", "application/json");
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");

  if (req.method === "POST") {
    const b = await body(req);
    if (path === "rank") return rank(res);
    if (path === "tensorboard") {
      await ensureTensorboard();
      return reply(res, { up: await tensorboardUp() });
    }
    if (path === "save-level") {
      const [seed, length] = [Number(b.seed), Number(b.length)];
      if (!Number.isInteger(seed) || !Number.isInteger(length) || length < 30 || length > 600 || !/^\w+$/.test(String(b.type))) return reply(res, { error: "Zły seed, długość (30-600) albo typ." }, 400);
      const level = new LevelGenerator(loadLibrary()).generate(seed, { length, type: b.type as LevelType });
      mkdirSync(GENERATED, { recursive: true });
      const given = typeof b.name === "string" ? b.name.trim() : "";
      if (given && !/^[\w-]{1,40}$/.test(given)) return reply(res, { error: "Nazwa: litery, cyfry, - i _ (do 40 znaków)." }, 400);
      const name = given || `${level.name}-${length}`;
      if (given && existsSync(join(GENERATED, `${name}.json`))) return reply(res, { error: "Poziom o tej nazwie już istnieje." }, 409);
      writeFileSync(join(GENERATED, `${name}.json`), JSON.stringify(level, null, 2));
      return reply(res, { ok: true, name });
    }
    if (!validName(b.run)) return reply(res, { error: "Nazwa: litery, cyfry, - i _ (do 40 znaków)." }, 400);
    if (path === "play") return play(res, b);
    const dir = join(RUNS, b.run);
    if (path === "train") {
      const active = listRuns().find(isRunning);
      if (active) return reply(res, { error: `Trening już działa: ${active}. Zatrzymaj go najpierw.` }, 409);
      if (b.resume && !existsSync(join(dir, "state.pt"))) return reply(res, { error: "Brak zapisanego stanu do kontynuacji." }, 400);
      if (!b.resume && existsSync(join(dir, "state.pt"))) return reply(res, { error: "Model o tej nazwie już istnieje. Wybierz „kontynuuj” albo inną nazwę." }, 400);
      mkdirSync(dir, { recursive: true });
      if (b.config) writeFileSync(join(dir, "config.json"), JSON.stringify(b.config, null, 2));
      startTraining(b.run, !!b.resume);
      return reply(res, { ok: true });
    }
    if (path === "stop") {
      if (!existsSync(dir)) return reply(res, { error: "Nie ma takiego modelu." }, 404);
      writeFileSync(join(dir, "stop.flag"), "");
      return reply(res, { ok: true });
    }
    if (path === "config") {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "config.json"), JSON.stringify(b.config ?? {}, null, 2));
      return reply(res, { ok: true });
    }
    return reply(res, { error: "unknown" }, 404);
  }

  if (path === "runs.json") return reply(res, listRuns());
  if (path === "models.json") return reply(res, listRuns().map(summary));
  if (path === "schema.json") return reply(res, defaultsOf());
  if (path === "status.json") {
    const active = listRuns().find(isRunning) ?? null;
    return reply(res, { active, gen: active ? heartbeat(active)?.gen ?? null : null });
  }
  if (path.startsWith("log/")) {
    const run = path.slice(4);
    return reply(res, { lines: validName(run) ? tail(join(RUNS, run, "train.log")) : [] });
  }
  const parts = path.split("/");
  if (parts.length === 2 && validName(parts[0]) && parts[1] === "config.json") return reply(res, configOf(parts[0]));

  const file = normalize(join(RUNS, path));
  if (!file.startsWith(RUNS) || !file.endsWith(".json") || !existsSync(file)) return reply(res, {}, 404);
  return reply(res, readFileSync(file, "utf8"));
}

export function botEvo(): Plugin {
  return {
    name: "bot-evo",
    configureServer(server) {
      server.middlewares.use("/__bot", (req, res) => {
        handle(req, res).catch((e) => reply(res, { error: String(e) }, 500));
      });
    },
  };
}
