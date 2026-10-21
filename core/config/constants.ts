// Units: positions and velocities are integers in subpixels (1 px = SUB).
// Sizes (hitboxes) are in pixels. Values come from shared/game.json.

import { CONFIG } from "./config.ts";

export const SUB = CONFIG.units.sub; // subpixels per pixel
export const TILE = CONFIG.units.tile; // block size in px, as in Mario
export const TILE_SUB = TILE * SUB;

export const FPS = CONFIG.units.fps; // one step() = one frame
export const SCREEN_W = CONFIG.units.screenW;
export const SCREEN_H = CONFIG.units.screenH;
