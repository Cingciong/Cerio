// All game constants come from shared/game.json (also read by Python: server/config.py).
// To add a button, tile, enemy or change physics: edit the JSON only.
//
// Units in the JSON: speeds/accelerations in subpixels per frame, sizes in px.
// Buttons are bit masks (next one = next power of 2). Tile ids must stay stable (saved levels use them).

import config from "../shared/game.json" with { type: "json" };

export const CONFIG = config;

export const Button = config.buttons;
export type ButtonName = keyof typeof config.buttons;

export const TILES = config.tiles;
export type TileName = keyof typeof config.tiles;

export const PLAYER = config.player;

export const PIRANHA = config.piranha;

export const ENEMIES: Record<string, EnemyConfig> = config.enemies;
export type EnemyConfig = (typeof config.enemies)[keyof typeof config.enemies];

export const RULES = config.rules;
export const VIEW = config.view;
