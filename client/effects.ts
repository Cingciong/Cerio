import { TILE, type GameEvent } from "../core/index.ts";

export interface CoinPop {
  area: string;
  x: number;
  y: number;
  vy: number;
  frames: number;
}

const COIN_POP_FRAMES = 30;
const COIN_POP_SPEED = 5;
const COIN_POP_GRAVITY = 0.35;

export const coinPops: CoinPop[] = [];

export function stepEffects(events: GameEvent[], area: string): void {
  for (const p of coinPops) {
    p.y += p.vy;
    p.vy += COIN_POP_GRAVITY;
    p.frames--;
  }
  for (let i = coinPops.length - 1; i >= 0; i--) if (coinPops[i].frames <= 0) coinPops.splice(i, 1);

  for (const e of events) {
    if (e.type !== "coinPop") continue;
    coinPops.push({ area, x: e.tx * TILE, y: (e.ty - 1) * TILE, vy: -COIN_POP_SPEED, frames: COIN_POP_FRAMES });
  }
}

export function clearEffects(): void {
  coinPops.length = 0;
}
