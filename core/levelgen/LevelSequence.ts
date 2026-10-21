import type { GenOptions, LevelGenerator } from "./LevelGenerator.ts";
import type { GeneratedLevel } from "./types.ts";

// Base seed = whole run, level seed = derived from 
// one number reproduces the whole run and runs from neighbouring seeds don't share levels. -Igor
export class LevelSequence {
  private index = 0;
  private gen: LevelGenerator;
  private baseSeed: number;
  private opts: GenOptions;

  constructor(gen: LevelGenerator, baseSeed: number, opts: GenOptions) {
    this.gen = gen;
    this.baseSeed = baseSeed;
    this.opts = opts;
  }

  next(): GeneratedLevel {
    const seed = (Math.imul(this.baseSeed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(this.index++, 0xc2b2ae35)) >>> 0;
    return this.gen.generate(seed, this.opts);
  }
}
