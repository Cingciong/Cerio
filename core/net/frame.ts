// Messages between the game and the server (JSON over WebSocket).
// GameFrame:   game -> server, player and all enemies in one frame.
// ServerReply: server -> game, buttons for the player and/or enemies.
// Units in messages: px and px/frame (floats), tiles as ids (tiles.ts).
// View size: shared/game.json "view". Python mirror: server/frame.py

import type { Buttons } from "../config/buttons.ts";
import { VIEW } from "../config/config.ts";
import { SUB } from "../config/constants.ts";
import type { Body } from "../entities/body.ts";
import type { GameState, Status } from "../sim/state.ts";
import { tileWindow, toTile } from "../world/tiles.ts";

export interface BodyFrame {
  x: number; // px, top-left
  y: number;
  vx: number; // px/frame
  vy: number;
  w: number; // hitbox px
  h: number;
  onGround: boolean;
}

export interface PlayerFrame extends BodyFrame {
  alive: boolean;
  buttons: Buttons; // pressed this frame
}

export interface EnemyFrame extends BodyFrame {
  id: number;
  type: string;
  alive: boolean;
}

export interface TileView {
  left: number; // tile x of the top-left corner
  top: number;
  width: number; // tiles
  height: number;
  tiles: number[]; // row-major tile ids, width * height
}

export interface GameFrame {
  frame: number;
  level: string;
  status: Status;
  player: PlayerFrame;
  enemies: EnemyFrame[];
  view: TileView;
}

export interface ServerReply {
  frame: number;
  player?: Buttons; // buttons for the player (bot); missing -> keyboard
  enemies?: Record<number, Buttons>; // buttons per enemy id; missing -> enemy.decide()
}

function bodyFrame(b: Body): BodyFrame {
  return { x: b.x / SUB, y: b.y / SUB, vx: b.vx / SUB, vy: b.vy / SUB, w: b.w, h: b.h, onGround: b.onGround };
}

export function toFrame(state: GameState): GameFrame {
  const { player } = state;
  const left = toTile(player.x) - VIEW.behind;
  const top = Math.min(0, toTile(player.y)); // follows the player above the map
  return {
    frame: state.frame,
    level: state.level.name,
    status: state.status,
    player: { ...bodyFrame(player), alive: player.alive, buttons: player.buttons },
    enemies: state.enemies.map((e) => ({ ...bodyFrame(e), id: e.id, type: e.type, alive: e.alive })),
    view: { left, top, width: VIEW.width, height: VIEW.height, tiles: tileWindow(state.map, left, top, VIEW.width, VIEW.height) },
  };
}
