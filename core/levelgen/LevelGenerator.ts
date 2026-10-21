import { Rng } from "../sim/rng.ts";
import type { AreaFile, SegmentSpan } from "../world/level.ts";
import { findLips, type PipeLink } from "../world/pipes.ts";
import { canFollow, joint } from "./segment.ts";
import { LengthPolicy } from "./LengthPolicy.ts";
import { planPipes } from "./PipePlan.ts";
import { SegmentChain, widthOf } from "./SegmentChain.ts";
import type { SegmentLibrary } from "./SegmentLibrary.ts";
import type { GeneratedLevel, LevelType, Segment } from "./types.ts";

const MAX_BACKTRACK = 20;
const MAX_ATTEMPTS = 5; // rebuilds when the pipe segments pushed the level out of the length range
const CAVE_CHANCE = 0.5;
const CAVE_OF: Partial<Record<LevelType, LevelType>> = { normal: "caves" };

const hasUpPipe = (s: Segment) => findLips(s.rows).some((l) => l.opens === "up");
const pipesOf = (area: AreaFile, name: string): PipeLink[] => findLips(area.rows).map((l) => ({ ...l, area: name, kind: "plain" }));

export interface GenOptions {
  length: number;
  tolerance?: number;
  type?: LevelType;
  types?: LevelType[];
}

interface Built {
  chain: SegmentChain;
  entry: number; // chain index of the entry / exit pipe segment, -1 if none
  exit: number;
}

/**
 * start enclosure -> [opener] -> middles -> [closer] -> end enclosure.
 * With a cave the entry and exit pipe segments are placed first (near the start and the end),
 * then the gaps are filled with segments of matching length.
 */
export class LevelGenerator {
  private lib: SegmentLibrary;

  constructor(lib: SegmentLibrary) {
    this.lib = lib;
  }

  /** Types a level can be of; cave types only appear as sub-areas. */
  mainTypes(): LevelType[] {
    const sub = new Set(Object.values(CAVE_OF));
    return this.lib.types().filter((t) => !sub.has(t));
  }

  generate(seed: number, opts: GenOptions): GeneratedLevel {
    const rng = new Rng(seed);
    const type = opts.type ?? rng.pick(opts.types ?? this.mainTypes());
    const caveType = CAVE_OF[type];
    const withCave = caveType !== undefined && this.lib.middles(caveType).length > 0 && rng.next() < CAVE_CHANCE;

    const policy = new LengthPolicy(opts.length, opts.tolerance);
    let built = this.build(type, rng, policy, withCave);
    for (let i = 0; i < MAX_ATTEMPTS && !policy.within(built.chain.width); i++) built = this.build(type, rng, policy, withCave);
    const { area, player } = built.chain.join();
    const level: GeneratedLevel = {
      name: `gen-${type}-${seed}`,
      type,
      seed,
      player: player ?? { x: 2, y: 11 },
      overworld: area,
      pipes: pipesOf(area, "overworld"),
    };

    if (built.entry >= 0 && built.exit >= 0) this.addCave(level, area.segments![built.entry], area.segments![built.exit], caveType!, rng);
    else if (withCave) console.warn(`level ${seed}: pipe segments did not fit, no cave`);
    return level;
  }

  private build(type: LevelType, rng: Rng, policy: LengthPolicy, withCave = false): Built {
    const endEnc = this.lib.enclosure(type, "end");
    const closers = this.lib.closers(type);
    const middles = this.lib.middles(type);
    const piped = middles.filter(hasUpPipe);
    const reserve = widthOf(endEnc) + (closers.length ? Math.min(...closers.map(widthOf)) : 0);
    const chain = new SegmentChain();
    let entry = -1;
    let exit = -1;

    chain.push(this.lib.enclosure(type, "start"));
    this.tryPush(chain, rng, this.lib.openers(type), 0, policy);

    if (withCave && piped.length) {
      const plan = planPipes(rng);
      const exitW = Math.max(...piped.map(widthOf));
      this.fillTo(chain, rng, middles, plan.entry * policy.target);
      if (this.tryPush(chain, rng, piped, reserve)) entry = chain.length - 1;
      this.fillTo(chain, rng, middles, Math.min(plan.exit * policy.target, policy.max - reserve - exitW));
      if (entry >= 0 && (this.tryPush(chain, rng, piped, reserve, policy) || this.tryPush(chain, rng, piped, reserve))) exit = chain.length - 1;
    }
    const fixed = chain.length;

    let backtracks = 0;
    while (!policy.done(chain.width, reserve)) {
      if (this.tryPush(chain, rng, middles, reserve, policy)) continue;
      if (chain.length <= fixed || backtracks++ >= MAX_BACKTRACK) break;
      chain.pop();
    }

    const endW = widthOf(endEnc);
    if (!this.tryPush(chain, rng, closers, endW, policy) && !policy.done(chain.width, endW)) this.tryPush(chain, rng, closers, endW);
    chain.push(endEnc);
    return { chain, entry, exit };
  }

  /** Add segments while their middle stays before tile x. */
  private fillTo(chain: SegmentChain, rng: Rng, pool: Segment[], x: number): void {
    for (;;) {
      const prev = chain.rightJoint();
      const fits = pool.filter((s) => canFollow(prev, joint(s.rows, "left")) && chain.width + widthOf(s) / 2 <= x);
      if (fits.length === 0) return;
      chain.push(rng.pick(fits));
    }
  }

  /**
   * Every up-opening pipe of the entry segment leads into the cave, the cave's end pipe leads to the first pipe
   * of the exit segment. The cave is as long as the part of the level it skips, ± one cave segment.
   */
  private addCave(level: GeneratedLevel, entrySpan: SegmentSpan, exitSpan: SegmentSpan, caveType: LevelType, rng: Rng): void {
    const inside = (p: PipeLink, s: SegmentSpan) => p.opens === "up" && p.x >= s.x && p.x < s.x + s.w;
    const ins = level.pipes.filter((p) => inside(p, entrySpan));
    const out = level.pipes.find((p) => inside(p, exitSpan));
    if (!ins.length || !out) return;

    const skipped = Math.max(1, out.x - ins[0].x);
    const widths = this.lib.middles(caveType).map(widthOf);
    const slack = widths.reduce((a, b) => a + b, 0) / widths.length;
    const cave = this.build(caveType, rng, new LengthPolicy(skipped, slack / skipped)).chain.join().area;

    const cavePipes = pipesOf(cave, "cave");
    const ceiling = cavePipes.filter((p) => p.opens === "down");
    const spawn = ceiling[0]; // in the start enclosure
    const back = ceiling[ceiling.length - 1]; // in the end enclosure
    level.pipes.push(...cavePipes);

    out.kind = spawn.kind = "exit";
    for (const p of ins) Object.assign(p, { kind: "entry", to: level.pipes.indexOf(spawn) });
    Object.assign(back, { kind: "entry", to: level.pipes.indexOf(out) });
    level.cave = cave;
  }

  private tryPush(chain: SegmentChain, rng: Rng, pool: Segment[], reserve: number, policy?: LengthPolicy): boolean {
    const prev = chain.rightJoint();
    const fits = pool.filter(
      (s) => canFollow(prev, joint(s.rows, "left")) && (!policy || policy.fits(chain.width + widthOf(s), reserve)),
    );
    if (fits.length === 0) return false;
    chain.push(rng.pick(fits));
    return true;
  }
}
