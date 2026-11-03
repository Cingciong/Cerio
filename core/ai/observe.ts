// What the bot sees. Written straight into a Buffer (no allocations per decision).
// Record layout (little endian), mirrored by bot-evo/evo/layout.py:
//   tiles   u8  h*w    tile ids around the player (row-major)
//   ents    u8  h*w    entity ids (enemy / item / projectile), 0 = empty
//   etype   u8  maxEnemies
//   scalars f32 scalars
//   enemies f32 maxEnemies*5   dx, dy, vx, vy, stompable

import { ENEMIES, ITEMS } from "../config/config.ts";
import { SUB, TILE, TILE_SUB } from "../config/constants.ts";
import type { PowerState } from "../entities/player.ts";
import type { GameState } from "../sim/state.ts";
import { tileAt, toTile } from "../world/tiles.ts";

export const OBS = { w: 32, h: 15, behind: 8, maxEnemies: 16, scalars: 15, enemyFloats: 5, slots: 32 } as const;

const CELLS = OBS.w * OBS.h;
const SCALARS_AT = CELLS * 2 + OBS.maxEnemies;
const ENEMIES_AT = SCALARS_AT + OBS.scalars * 4;
export const OBS_BYTES = ENEMIES_AT + OBS.maxEnemies * OBS.enemyFloats * 4;

const POWER: PowerState[] = ["small", "big", "fire", "hammer_suit", "star", "leaf", "tanooki", "frog"];

/** Entity ids: enemies 1.., then items, then projectiles. */
export const ENTITY_IDS: Record<string, number> = {};
for (const name of [...Object.keys(ENEMIES), ...Object.keys(ITEMS), "fireball", "hammer"]) {
  if (!(name in ENTITY_IDS)) ENTITY_IDS[name] = Object.keys(ENTITY_IDS).length + 1;
}
if (Object.keys(ENTITY_IDS).length >= OBS.slots) throw new Error("too many entity types for the embedding table");

export function writeObservation(buf: Buffer, off: number, state: GameState): void {
  buf.fill(0, off, off + OBS_BYTES);
  const { player, map } = state;
  const cx = player.x + (player.w * SUB) / 2;
  const cy = player.y + (player.h * SUB) / 2;
  const left = toTile(cx) - OBS.behind;

  for (let ty = 0; ty < OBS.h; ty++) {
    for (let tx = 0; tx < OBS.w; tx++) buf[off + ty * OBS.w + tx] = tileAt(map, left + tx, ty);
  }

  const put = (x: number, y: number, w: number, h: number, id: number): boolean => {
    const gx = toTile(x + (w * SUB) / 2) - left;
    const gy = toTile(y + (h * SUB) / 2);
    if (gx < 0 || gx >= OBS.w) return false;
    if (gy >= 0 && gy < OBS.h) buf[off + CELLS + gy * OBS.w + gx] = id;
    return true;
  };

  let slot = 0;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const id = ENTITY_IDS[e.type] ?? OBS.slots - 1;
    if (!put(e.x, e.y, e.w, e.h, id) || slot >= OBS.maxEnemies) continue;
    const at = off + SCALARS_AT + OBS.scalars * 4 + slot * OBS.enemyFloats * 4;
    buf.writeFloatLE((e.x + (e.w * SUB) / 2 - cx) / TILE_SUB / 16, at);
    buf.writeFloatLE((e.y + (e.h * SUB) / 2 - cy) / TILE_SUB / 8, at + 4);
    buf.writeFloatLE(e.vx / SUB / 4, at + 8);
    buf.writeFloatLE(e.vy / SUB / 4, at + 12);
    buf.writeFloatLE(e.stompable ? 1 : 0, at + 16);
    buf[off + CELLS * 2 + slot] = id;
    slot++;
  }
  for (const it of state.items) if (it.alive) put(it.x, it.y, it.w, it.h, ENTITY_IDS[it.type]);
  for (const p of state.projectiles) if (p.alive) put(p.x, p.y, p.w, p.h, ENTITY_IDS[p.type]);

  const s = off + SCALARS_AT;
  const frac = (v: number) => (((v % TILE_SUB) + TILE_SUB) % TILE_SUB) / TILE_SUB;
  buf.writeFloatLE(player.vx / SUB / 4, s);
  buf.writeFloatLE(player.vy / SUB / 4, s + 4);
  buf.writeFloatLE(player.onGround ? 1 : 0, s + 8);
  buf.writeFloatLE(frac(cx), s + 12);
  buf.writeFloatLE(frac(cy), s + 16);
  const power = POWER.indexOf(player.powerState);
  if (power >= 0) buf.writeFloatLE(1, s + 20 + power * 4);
  buf.writeFloatLE(Math.min(1, player.invulnerableTimer / 600), s + 52);
  buf.writeFloatLE(state.area === "overworld" ? 0 : 1, s + 56);
}

/** Width of the overworld in px. */
export const mapPx = (state: GameState): number => state.maps.overworld.width * TILE;
