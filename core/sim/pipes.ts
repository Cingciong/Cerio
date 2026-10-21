// Entering pipes as in SMB: stand on an up-opening pipe and hold Down, or hit a ceiling pipe with your head while holding Jump.
// The player slides 1 px per frame without control, switches area, then slides out of the target pipe.

import { Button, has, type Buttons } from "../config/buttons.ts";
import { SUB, TILE, TILE_SUB } from "../config/constants.ts";
import type { Body } from "../entities/body.ts";
import { PiranhaPlant } from "../entities/enemy.ts";
import type { Player } from "../entities/player.ts";
import type { PipeLink } from "../world/pipes.ts";
import { setArea, type GameState } from "./state.ts";

const MARGIN = 4 * SUB; // the player's centre must be this far inside the opening

export interface PipeTravel {
  pipe: number; // index in level.pipes
  phase: "enter" | "exit";
  frames: number;
}

function centred(player: Player, p: PipeLink): boolean {
  const c = player.x + (player.w * SUB) / 2;
  return c >= p.x * TILE_SUB + MARGIN && c <= (p.x + 2) * TILE_SUB - MARGIN;
}

function onPipe(b: Body, p: PipeLink): boolean {
  const c = b.x + (b.w * SUB) / 2;
  return c >= p.x * TILE_SUB && c <= (p.x + 2) * TILE_SUB;
}

function canEnter(state: GameState, buttons: Buttons, p: PipeLink): boolean {
  const { player } = state;
  if (p.kind !== "entry" || p.to === undefined || p.area !== state.area || !centred(player, p)) return false;
  return p.opens === "up"
    ? player.onGround && has(buttons, Button.down) && player.bottom === p.y * TILE_SUB
    : has(buttons, Button.jump) && player.y === (p.y + 1) * TILE_SUB;
}

export function tryEnterPipe(state: GameState, buttons: Buttons): boolean {
  const i = state.level.pipes.findIndex((p) => canEnter(state, buttons, p));
  if (i < 0) return false;
  state.player.vx = state.player.vy = 0;
  state.pipe = { pipe: i, phase: "enter", frames: state.player.h };
  return true;
}

export function stepPipe(state: GameState): void {
  const travel = state.pipe!;
  const p = state.level.pipes[travel.pipe];
  const { player } = state;
  const down = (travel.phase === "enter") === (p.opens === "up");
  player.y += down ? SUB : -SUB;
  if (--travel.frames > 0) return;

  if (travel.phase === "exit") {
    state.pipe = undefined;
    return;
  }
  const target = state.level.pipes[p.to!];
  setArea(state, target.area);
  for (const e of state.enemies) if (e instanceof PiranhaPlant && onPipe(e, target)) e.hide();
  player.x = target.x * TILE_SUB + ((2 * TILE - player.w) / 2) * SUB;
  player.y = target.opens === "up" ? target.y * TILE_SUB : (target.y + 1) * TILE_SUB - player.h * SUB;
  player.onGround = false;
  state.pipe = { pipe: p.to!, phase: "exit", frames: player.h };
}
