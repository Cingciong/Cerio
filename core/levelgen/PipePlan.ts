import type { Rng } from "../sim/rng.ts";

const SIGMA = 0.2;

/** Inverted Gaussian over level progress t in [0, 1]: 0 in the middle, close to 1 at both ends. */
export function pipeChance(t: number, sigma = SIGMA): number {
  return 1 - Math.exp(-((t - 0.5) ** 2) / (2 * sigma ** 2));
}

/** Random t in [from, to) weighted by pipeChance (rejection sampling). */
function sample(rng: Rng, from: number, to: number): number {
  for (;;) {
    const t = from + rng.next() * (to - from);
    if (rng.next() < pipeChance(t)) return t;
  }
}

/** Where the entry (first half) and exit (second half) pipe segments start, as a fraction of the level length. */
export function planPipes(rng: Rng): { entry: number; exit: number } {
  return { entry: sample(rng, 0, 0.5), exit: sample(rng, 0.5, 1) };
}
