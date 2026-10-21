import { Rng } from "../sim/rng.ts";
import { canFollow, joint } from "./segment.ts";
import { LengthPolicy } from "./LengthPolicy.ts";
import { SegmentChain, widthOf } from "./SegmentChain.ts";
import type { SegmentLibrary } from "./SegmentLibrary.ts";
import type { GeneratedLevel, LevelType, Segment } from "./types.ts";

const MAX_BACKTRACK = 20;

export interface GenOptions {
  length: number;
  tolerance?: number;
  type?: LevelType;
  types?: LevelType[];
}

/** start enclosure -> [opener] -> middles -> [closer] -> end enclosure */
export class LevelGenerator {
  private lib: SegmentLibrary;

  constructor(lib: SegmentLibrary) {
    this.lib = lib;
  }

  generate(seed: number, opts: GenOptions): GeneratedLevel {
    const rng = new Rng(seed);
    const type = opts.type ?? rng.pick(opts.types ?? this.lib.types());
    const policy = new LengthPolicy(opts.length, opts.tolerance);
    const endEnc = this.lib.enclosure(type, "end");
    const chain = new SegmentChain();

    chain.push(this.lib.enclosure(type, "start"));
    this.tryPush(chain, rng, this.lib.openers(type), 0, policy);

    const closers = this.lib.closers(type);
    const reserve = widthOf(endEnc) + (closers.length ? Math.min(...closers.map(widthOf)) : 0);
    const middles = this.lib.middles(type);
    let backtracks = 0;
    while (!policy.done(chain.width, reserve)) {
      if (this.tryPush(chain, rng, middles, reserve, policy)) continue;
      if (chain.length <= 2 || backtracks++ >= MAX_BACKTRACK) break;
      chain.pop();
    }
    if (!policy.done(chain.width, reserve)) console.warn(`level ${seed}: ${chain.width} tiles, wanted >= ${policy.min}`);

    this.tryPush(chain, rng, closers, widthOf(endEnc), policy);
    chain.push(endEnc);

    const file = chain.join(`gen-${type}-${seed}`);
    if (!file.player) file.player = { x: 2, y: 11 };
    return { ...file, type, seed };
  }

  private tryPush(chain: SegmentChain, rng: Rng, pool: Segment[], reserve: number, policy: LengthPolicy): boolean {
    const prev = chain.rightJoint();
    const fits = pool.filter((s) => canFollow(prev, joint(s.rows, "left")) && policy.fits(chain.width + widthOf(s), reserve));
    if (fits.length === 0) return false;
    chain.push(rng.pick(fits));
    return true;
  }
}
