import { RULES, TILES } from "../config/config.ts";
import { isSlotItem, type SlotItem } from "../entities/powerup.ts";
import type { Rng } from "../sim/rng.ts";
import type { AreaFile } from "../world/level.ts";

//!!! POWERUP RULES
export interface PowerupPolicy {
  rate: number;
  firstMushroom: boolean;
  minGap: number;
  weights: Partial<Record<SlotItem, number>>;
  max: Partial<Record<SlotItem, number>>;
}

export const DEFAULT_POLICY: PowerupPolicy = RULES.slots as PowerupPolicy;


export const SLOT_SALT = 0x51075107; //ranadom val

const QUESTION = TILES.question.char;

export interface Slot {
  x: number;
  y: number;
}


export function findSlots(area: AreaFile): Slot[] {
  const out: Slot[] = [];
  const width = Math.max(...area.rows.map((r) => r.length));
  for (let x = 0; x < width; x++) {
    area.rows.forEach((r, y) => {
      if (r[x] === QUESTION) out.push({ x, y });
    });
  }
  return out;
}

function pick(rng: Rng, policy: PowerupPolicy, used: Partial<Record<SlotItem, number>>): SlotItem | undefined {
  const pool = (Object.entries(policy.weights) as [SlotItem, number][])
    .filter(([item, w]) => w > 0 && isSlotItem(item) && item !== "coin" && (used[item] ?? 0) < (policy.max[item] ?? Infinity))
    .sort(([a], [b]) => (a < b ? -1 : 1)); // fixed order, so the same seed gives the same result
  const total = pool.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return undefined;
  let r = rng.next() * total;
  for (const [item, w] of pool) if ((r -= w) < 0) return item;
  return pool[pool.length - 1][0];
}


export function fillSlots(areas: AreaFile[], rng: Rng, opts: Partial<PowerupPolicy> = {}): void {
  const policy: PowerupPolicy = { ...DEFAULT_POLICY, ...opts, rate: Math.min(1, Math.max(0, opts.rate ?? DEFAULT_POLICY.rate)) };
  const used: Partial<Record<SlotItem, number>> = {};
  for (const area of areas) for (const b of area.blocks ?? []) used[b.item as SlotItem] = (used[b.item as SlotItem] ?? 0) + 1;

  let first = policy.firstMushroom && policy.rate > 0;
  for (const area of areas) {
    const blocks = (area.blocks ??= []);
    const pinned = new Set(blocks.map((b) => `${b.x},${b.y}`));
    let lastPower = -Infinity;
    for (const s of findSlots(area)) {
      if (pinned.has(`${s.x},${s.y}`)) continue;
      let item: SlotItem | undefined;
      if (first) item = "mushroom";
      else if (s.x - lastPower >= policy.minGap && rng.next() < policy.rate) item = pick(rng, policy, used);
      first = false;
      if (item) lastPower = s.x;
      item ??= "coin";
      used[item] = (used[item] ?? 0) + 1;
      blocks.push({ x: s.x, y: s.y, item });
    }
    blocks.sort((a, b) => a.x - b.x || a.y - b.y);
  }
}


export function blockStats(areas: AreaFile[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of areas) for (const b of a.blocks ?? []) out[b.item] = (out[b.item] ?? 0) + 1;
  return out;
}
