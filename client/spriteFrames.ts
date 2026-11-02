import { Tile } from "../core/world/tiles.ts";

export interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

function cells(indices: number[], cellWidth = 32, cellHeight = 32): SpriteFrame[] {
  return indices.map((index) => ({
    x: index * cellWidth,
    y: 0,
    width: cellWidth,
    height: cellHeight,
  }));
}

export const MARIO_IDLE: SpriteFrame = { x: 6, y: 14, width: 18, height: 18 };
export const MARIO_WALK: SpriteFrame[] = [1, 2, 3].map((index) => ({
  x: index * 32 + 6,
  y: 14,
  width: 18,
  height: 18,
}));
export const MARIO_JUMP: SpriteFrame = { x: 5 * 32 + 6, y: 14, width: 18, height: 18 };
export const MARIO_SMALL_FRAMES = cells([0, 1, 2, 3, 4, 5, 6, 7]);
export const MARIO_BIG_FRAMES = cells([8, 9, 10, 11, 12, 13, 14, 15, 16]);
export const MARIO_FIRE_FRAMES = cells([17, 18, 19, 20, 21, 22]);

export const GOOMBA_WALK: SpriteFrame[] = [0, 1].map((index) => ({
  x: index * 32 + 7,
  y: 15,
  width: 18,
  height: 17,
}));
export const GOOMBA_SQUASHED = cells([2])[0];

export const KOOPA_WALK: SpriteFrame[] = [3, 4].map((index) => ({
  x: index * 32 + 5,
  y: 7,
  width: 18,
  height: 25,
}));
export const KOOPA_SHELL: SpriteFrame[] = [5, 6].map((index) => ({
  x: index * 32 + 7,
  y: 16,
  width: 18,
  height: 16,
}));
export const HAMMER_BRO_FRAMES: SpriteFrame[] = [
  { x: 9 * 32 + 7, y: 7, width: 16, height: 25 },
  { x: 10 * 32 + 7, y: 6, width: 16, height: 26 },
  { x: 11 * 32 + 5, y: 6, width: 18, height: 26 },
  { x: 12 * 32 + 5, y: 5, width: 18, height: 27 },
];
export const PIRANHA_PLANT_FRAMES: SpriteFrame[] = [
  { x: 7 * 32 + 7, y: 8, width: 18, height: 24 },
  { x: 8 * 32 + 6, y: 6, width: 20, height: 26 },
];
export const HAMMER_PROJECTILE: SpriteFrame = { x: 13 * 32 + 10, y: 8, width: 13, height: 17 };
export const SPINY_FRAMES: SpriteFrame[] = [
  { x: 19 * 32 + 7, y: 15, width: 17, height: 17 },
  { x: 20 * 32 + 9, y: 15, width: 16, height: 17 },
];
export const BUZZY_WALK_FRAMES: SpriteFrame[] = [
  { x: 3, y: 12, width: 19, height: 16 },
  { x: 25, y: 12, width: 19, height: 16 },
  { x: 47, y: 12, width: 19, height: 16 },
  { x: 69, y: 12, width: 19, height: 16 },
];
export const BUZZY_SHELL_FRAMES: SpriteFrame[] = [
  { x: 3, y: 38, width: 18, height: 14 },
  { x: 22, y: 38, width: 18, height: 14 },
  { x: 41, y: 38, width: 19, height: 14 },
  { x: 62, y: 38, width: 18, height: 14 },
];
export const BUZZY_WINGS: SpriteFrame = { x: 92, y: 16, width: 28, height: 14 };
export const PODOBOO_FRAMES: SpriteFrame[] = [
  { x: 0, y: 0, width: 16, height: 16 },
  { x: 2, y: 18, width: 12, height: 12 },
  { x: 3, y: 35, width: 10, height: 10 },
  { x: 4, y: 52, width: 8, height: 8 },
  { x: 5, y: 69, width: 6, height: 6 },
];
export const BOWSER_WALK_FRAMES: SpriteFrame[] = [0, 37, 74, 111].map((x) => ({
  x,
  y: 0,
  width: 35,
  height: 34,
}));
export const BUZZY_BEETLE_WALK: SpriteFrame[] = [
  { x: 5, y: 15, width: 21, height: 17 },
  { x: 37, y: 15, width: 21, height: 17 },
];
export const BUZZY_BEETLE_SHELL: SpriteFrame = { x: 68, y: 15, width: 23, height: 17 };
export const BULLET_BILL: SpriteFrame = { x: 99, y: 11, width: 21, height: 21 };
export const BULLET_BILL_CANNON: SpriteFrame = { x: 133, y: 11, width: 19, height: 21 };

export const SUPER_MUSHROOM: SpriteFrame = { x: 0, y: 0, width: 16, height: 16 };
export const ONE_UP_MUSHROOM: SpriteFrame = { x: 16, y: 0, width: 16, height: 16 };
export const FIRE_FLOWER: SpriteFrame = { x: 32, y: 0, width: 16, height: 16 };
export const SUPER_STAR: SpriteFrame = { x: 48, y: 0, width: 16, height: 16 };
export const BRICK_DEBRIS_FRAMES: SpriteFrame[] = [
  { x: 5, y: 20, width: 8, height: 8 },
  { x: 20, y: 20, width: 8, height: 8 },
];
export const COIN_FRAMES: SpriteFrame[] = [0, 16, 32, 48].map((x) => ({
  x,
  y: 16,
  width: 16,
  height: 16,
}));
export const OVERWORLD_CLOUD: SpriteFrame = { x: 88, y: 32, width: 40, height: 32 };
export const OVERWORLD_SMALL_HILL: SpriteFrame = { x: 5, y: 89, width: 35, height: 23 };
export const OVERWORLD_LARGE_HILL: SpriteFrame = { x: 48, y: 77, width: 80, height: 35 };
export const AXE_FRAME: SpriteFrame = { x: 0, y: 0, width: 240, height: 368 };
export const BRIDGE_LOG: SpriteFrame = { x: 0, y: 0, width: 16, height: 25 };

export const TILE_SPRITES: Partial<Record<number, SpriteFrame>> = {
  [Tile.floor]: { x: 0, y: 0, width: 16, height: 16 },
  [Tile.question]: { x: 64, y: 0, width: 16, height: 16 },
  [Tile.pipe_left_top]: { x: 96, y: 0, width: 16, height: 16 },
  [Tile.pipe_right_top]: { x: 112, y: 0, width: 16, height: 16 },
  [Tile.pipe_left_body]: { x: 96, y: 16, width: 16, height: 16 },
  [Tile.pipe_right_body]: { x: 112, y: 16, width: 16, height: 16 },
  [Tile.brick]: { x: 48, y: 0, width: 16, height: 16 },
  [Tile.hard]: { x: 16, y: 0, width: 16, height: 16 },
  [Tile.used]: { x: 32, y: 0, width: 16, height: 16 },
  [Tile.brick_coins]: { x: 48, y: 0, width: 16, height: 16 },
  [Tile.brick_star]: { x: 48, y: 0, width: 16, height: 16 },
  [Tile.brick_vine]: { x: 48, y: 0, width: 16, height: 16 },
};

export const POWERUP_SPRITES: Record<string, SpriteFrame> = {
  mushroom:    { x: 0, y: 0, width: 16, height: 16 },
  flower:      { x: 16, y: 0, width: 16, height: 16 },
  star:        { x: 0, y: 16, width: 16, height: 16 },
  leaf:        { x: 48, y: 0, width: 16, height: 16 },
  hammer_suit: { x: 112, y: 16, width: 16, height: 16 },
  frog:        { x: 128, y: 0, width: 16, height: 16 },
  tanooki:     { x: 144, y: 16, width: 16, height: 16 },
  stopwatch:   { x: 192, y: 16, width: 16, height: 16 }
};