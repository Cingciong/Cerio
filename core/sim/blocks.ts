import { BLOCKS, TILES, type TileName } from "../config/config.ts";
import { SUB, TILE_SUB } from "../config/constants.ts";
import { isSolid, setTile, Tile, tileAt, toTile } from "../world/tiles.ts";
import type { GameState } from "./state.ts";

export interface Bump {
  tx: number;
  ty: number;
  frames: number; // left
}

/** Brick piece after breaking. Visual only, does not collide. */
export interface Debris {
  x: number; // subpixels
  y: number;
  vx: number;
  vy: number;
}

/** The player hit a solid tile from below. */
export interface GameEvent {
  type: "blockBump" | "blockBreak";
  tx: number;
  ty: number;
}

type HitBehaviour =(state: GameState, tx: number, ty: number) => void;

const HIT: Record<string, HitBehaviour> = {
  bump,
  break: (state, tx, ty) => {
    // TODO Filip/Jan: tylko duży Mario rozbija bricki, mały je tylko podbija: if (!state.player.big) return bump(state, tx, ty);
    killOnTop(state, tx, ty);
    setTile(state.map, tx, ty, Tile.air);
    spawnDebris(state, tx, ty);
    state.events.push({ type: "blockBreak", tx, ty });
  },
  becomes: (state, tx, ty) => {
    const t = Object.values(TILES).find((t) => t.id === tileAt(state.map, tx, ty)) as { becomes?: TileName };
    if (t.becomes) setTile(state.map, tx, ty, Tile[t.becomes]);
    bump(state, tx, ty);
  },
};

const HIT_OF: Record<number, HitBehaviour> = {};
for (const t of Object.values(TILES) as { id: number; hit?: string }[]) {
  if (t.hit) HIT_OF[t.id] = HIT[t.hit];
}

function bump(state: GameState, tx: number, ty: number): void {
  killOnTop(state, tx, ty);
  state.bumps.push({ tx, ty, frames: BLOCKS.bumpFrames });
  state.events.push({ type: "blockBump", tx, ty });
}


function killOnTop(state: GameState, tx: number, ty: number): void {
  const top = ty * TILE_SUB;
  for (const e of state.enemies) {
    const standing = e.bottom >= top - 2 * SUB && e.bottom <= top;
    if (e.alive && standing && e.right > tx * TILE_SUB && e.x < (tx + 1) * TILE_SUB) e.alive = false;
  }
}

function spawnDebris(state: GameState, tx: number, ty: number): void {
  const x = tx * TILE_SUB;
  const y = ty * TILE_SUB;
  const half = TILE_SUB / 2;
  for (const [dx, dy, jump] of [[0, 0, 1], [half, 0, 1], [0, half, 0.5], [half, half, 0.5]]) {
    state.debris.push({ x: x + dx, y: y + dy, vx: dx ? BLOCKS.debrisSpeed : -BLOCKS.debrisSpeed, vy: -BLOCKS.debrisJump * jump });
  }
}

export function hitBlockAbove(state: GameState): void {
  const { player, map } = state;
  const ty = toTile(player.y - 1);
  const centre = player.x + (player.w * SUB) / 2;
  let best = -1;
  for (let tx = toTile(player.x); tx <= toTile(player.right - 1); tx++) {
    if (!isSolid(map, tx, ty)) continue;
    if (best < 0 || Math.abs((tx + 0.5) * TILE_SUB - centre) < Math.abs((best + 0.5) * TILE_SUB - centre)) best = tx;
  }
  if (best >= 0) HIT_OF[tileAt(map, best, ty)]?.(state, best, ty);
}

export function stepBlocks(state: GameState): void {
  for (const b of state.bumps) b.frames--;
  state.bumps = state.bumps.filter((b) => b.frames > 0);
  for (const d of state.debris) {
    d.x += d.vx;
    d.y += d.vy;
    d.vy += BLOCKS.debrisGravity;
  }
  state.debris = state.debris.filter((d) => d.y < (state.map.height + 1) * TILE_SUB);
}

/** How many px a bumped tile is raised now (up and back down). */
export function bumpOffset(state: GameState, tx: number, ty: number): number {
  const b = state.bumps.find((b) => b.tx === tx && b.ty === ty);
  return b ? Math.round(BLOCKS.bumpPx * Math.sin((Math.PI * b.frames) / BLOCKS.bumpFrames)) : 0;
}
