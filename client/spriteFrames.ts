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
export const SPINY_FRAMES = cells([19, 20]);

export const SUPER_MUSHROOM: SpriteFrame = { x: 0, y: 0, width: 16, height: 16 };
export const ONE_UP_MUSHROOM: SpriteFrame = { x: 16, y: 0, width: 16, height: 16 };
export const FIRE_FLOWER: SpriteFrame = { x: 32, y: 0, width: 16, height: 16 };
export const SUPER_STAR: SpriteFrame = { x: 48, y: 0, width: 16, height: 16 };
export const COIN_FRAMES: SpriteFrame[] = [0, 16, 32, 48].map((x) => ({
  x,
  y: 16,
  width: 16,
  height: 16,
}));

export const TILE_SPRITES: Partial<Record<number, SpriteFrame>> = {
  [Tile.floor]: { x: 0, y: 0, width: 16, height: 16 },
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
