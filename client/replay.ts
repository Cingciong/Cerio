// Plays back what bot-evo recorded: level seed + buttons per decision. The simulation is deterministic, so the run looks exactly like it did in training.
// ?watch=<run>            follows the newest generation (refreshes by itself while training)
// ?watch=<run>&gen=7      a fixed generation, gen=val the best validated one
// ?watch                  newest run

import type { Level } from "../core/index.ts";

export interface ReplayLevel {
  seed: number;
  length: number;
  type: string;
  segment?: string; // map from levels/<folder>/ or "generated/<name>", instead of seed
  progress: number;
  coins: number;
  won: boolean;
  actions: number[];
}

export interface Replay {
  run: string;
  gen: number;
  score: number;
  repeat: number;
  levels: ReplayLevel[];
}

export type LevelOf = (level: ReplayLevel) => Level;

const HOLD_FRAMES = 90; // pause on the last frame before the next level

export class ReplayPlayer {
  private data: Replay | null = null;
  private pending: Replay | null = null;
  private current: ReplayLevel | null = null;
  private index = -1;
  private hold = 0;
  private run = "";
  private watch: string;
  private gen: string | null;
  private levelOf: LevelOf;
  private title: string | null = null;

  /** `fixed`: a replay that is already computed (a bot playing a chosen level); nothing is fetched or refreshed. */
  constructor(watch: string, gen: string | null, levelOf: LevelOf, fixed?: { data: Replay; title: string }) {
    this.watch = watch;
    this.gen = gen;
    this.levelOf = levelOf;
    if (fixed) {
      this.data = fixed.data;
      this.title = fixed.title;
    } else void this.start();
  }

  private async get(path: string): Promise<Replay | null> {
    try {
      const r = await fetch(`/__bot/${path}`, { cache: "no-store" });
      return r.ok ? ((await r.json()) as Replay) : null;
    } catch {
      return null;
    }
  }

  private async start(): Promise<void> {
    this.run = this.watch;
    if (!this.run || this.run === "latest") {
      const runs = (await (await fetch("/__bot/runs.json", { cache: "no-store" })).json()) as string[];
      this.run = runs[0] ?? "";
    }
    const file = this.gen === "val" ? "best_val_replay.json" : this.gen ? `replays/gen_${this.gen.padStart(4, "0")}.json` : "latest.json";
    this.data = await this.get(`${this.run}/${file}`);
    if (!this.gen) setInterval(() => void this.poll(), 3000);
  }

  private async poll(): Promise<void> {
    const next = await this.get(`${this.run}/latest.json`);
    if (next && this.data && next.gen > this.data.gen) this.pending = next;
  }

  private advance(): Level | undefined {
    if (!this.data || this.data.levels.length === 0) return undefined;
    this.index++;
    if (this.index >= this.data.levels.length) {
      this.index = 0;
      if (this.pending) [this.data, this.pending] = [this.pending, null];
    }
    this.current = this.data.levels[this.index];
    return this.levelOf(this.current);
  }

  /** Call before every step. `frozen`: do not step (waiting for data or pausing after the run). */
  tick(state: { frame: number; status: string }): { buttons: number; frozen: boolean; level?: Level } {
    if (!this.current || !this.data) {
      const level = this.advance();
      return { buttons: 0, frozen: true, level };
    }
    const over = state.status !== "playing" || state.frame >= this.current.actions.length * this.data.repeat;
    if (over && ++this.hold > HOLD_FRAMES) {
      this.hold = 0;
      return { buttons: 0, frozen: true, level: this.advance() };
    }
    if (over) return { buttons: 0, frozen: true };
    return { buttons: this.current.actions[Math.floor(state.frame / this.data.repeat)] ?? 0, frozen: false };
  }

  label(): string {
    const d = this.data;
    if (!d || !this.current) return `bot-evo ${this.run || "..."}: waiting for a replay`;
    const c = this.current;
    if (this.title) return `${this.title}  progress ${Math.round(c.progress * 100)}%${c.won ? " WIN" : ""}`;
    return `bot-evo ${d.run} gen ${d.gen} score ${Math.round(d.score)}  level ${this.index + 1}/${d.levels.length} progress ${Math.round(c.progress * 100)}%${c.won ? " WIN" : ""}`;
  }
}
