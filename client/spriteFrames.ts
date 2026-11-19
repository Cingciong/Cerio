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

export const MARIO_TANOOKI_FRAMES: SpriteFrame[] = [
  { x: 0 * 32, y: 0, width: 32, height: 32 },
  { x: 1 * 32, y: 0, width: 32, height: 32 }, 
  { x: 2 * 32, y: 0, width: 32, height: 32 }, 
  { x: 3 * 32, y: 0, width: 32, height: 32 },
  { x: 4 * 32, y: 0, width: 32, height: 32 }, 
  { x: 5 * 32, y: 0, width: 32, height: 32 },
  { x: 6 * 32, y: 0, width: 32, height: 32 },
  { x: 7 * 32, y: 0, width: 32, height: 32 },
];

export const GOOMBA_WALK: SpriteFrame[] = [0, 1].map((index) => ({
  x: index * 32 + 7,
  y: 15,
  width: 18,
  height: 17,
}));
export const GOOMBA_SQUASHED: SpriteFrame = { x: 71, y: 23, width: 26, height: 9 };
export const MINI_GOOMBA_FRAMES: SpriteFrame[] = [
  { x: 0, y: 0, width: 10, height: 11 },
  { x: 10, y: 0, width: 10, height: 11 },
];

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
export const PARATROOPA_WING: SpriteFrame = { x: 0, y: 0, width: 22, height: 22 };
export const PARATROOPA_WING_FRAMES = [
  { frame: PARATROOPA_WING, height: 15 },
  { frame: PARATROOPA_WING, height: 12 },
];
export const PODOBOO_FRAMES: SpriteFrame[] = [
  { x: 0, y: 0, width: 16, height: 16 },
  { x: 2, y: 18, width: 12, height: 12 },
  { x: 3, y: 35, width: 10, height: 10 },
  { x: 4, y: 52, width: 8, height: 8 },
  { x: 5, y: 69, width: 6, height: 6 },
];
export const BOWSER_WALK_FRAMES: SpriteFrame[] = [74, 111].map((x) => ({
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
export const BULLET_BILL: SpriteFrame = { x: 1, y: 1, width: 23, height: 15 };
export const BULLET_BILL_CANNON: SpriteFrame = { x: 1, y: 21, width: 23, height: 21 };
export const TEMP_BULLET_BILL: SpriteFrame = { x: 99, y: 11, width: 21, height: 21 };
export const TEMP_BULLET_BILL_CANNON: SpriteFrame = { x: 133, y: 11, width: 19, height: 21 };

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

export const SMB3_MARIO_SMALL_FRAMES: SpriteFrame[] = [
  { x: 9, y: 16, width: 60, height: 75 },
  { x: 84, y: 11, width: 75, height: 80 },
  { x: 174, y: 11, width: 70, height: 80 },
  { x: 259, y: 11, width: 80, height: 80 },
  { x: 354, y: 11, width: 80, height: 80 },
  { x: 444, y: 11, width: 80, height: 80 },
  { x: 539, y: 11, width: 80, height: 80 },
  { x: 634, y: 11, width: 75, height: 80 },
  { x: 719, y: 16, width: 70, height: 75 },
];

export const SMB3_MARIO_SUPER_FRAMES: SpriteFrame[] = [
  { x: 18, y: 48, width: 80, height: 105 },
  { x: 113, y: 48, width: 80, height: 105 },
  { x: 208, y: 18, width: 70, height: 135 },
  { x: 293, y: 18, width: 80, height: 135 },
  { x: 388, y: 23, width: 80, height: 130 },
  { x: 483, y: 13, width: 80, height: 140 },
  { x: 578, y: 23, width: 80, height: 130 },
  { x: 673, y: 18, width: 95, height: 135 },
  { x: 783, y: 18, width: 95, height: 135 },
  { x: 898, y: 23, width: 95, height: 130 },
  { x: 1008, y: 23, width: 95, height: 130 },
];

export const SMB3_MARIO_FIRE_FRAMES: SpriteFrame[] = [
  { x: 8, y: 48, width: 64, height: 84 },
  { x: 260, y: 24, width: 56, height: 108 },
  { x: 328, y: 24, width: 64, height: 108 },
  { x: 404, y: 28, width: 64, height: 104 },
  { x: 480, y: 20, width: 64, height: 112 },
  { x: 556, y: 24, width: 56, height: 108 },
  { x: 624, y: 24, width: 56, height: 108 },
  { x: 692, y: 28, width: 64, height: 104 },
  { x: 768, y: 24, width: 76, height: 108 },
  { x: 856, y: 24, width: 76, height: 108 },
  { x: 948, y: 28, width: 76, height: 104 },
  { x: 1036, y: 28, width: 76, height: 104 },
];
export const SMB3_FIREBALL_FRAMES: SpriteFrame[] = [
  { x: 80, y: 80, width: 32, height: 36 },
  { x: 128, y: 80, width: 32, height: 36 },
  { x: 172, y: 80, width: 32, height: 36 },
  { x: 216, y: 80, width: 32, height: 36 },
];

export const SMB3_MARIO_HAMMER_FRAMES: SpriteFrame[] = [
  { x: 29, y: 55, width: 64, height: 83 },
  { x: 105, y: 55, width: 64, height: 83 },
  { x: 181, y: 67, width: 32, height: 55 },
  { x: 225, y: 27, width: 64, height: 111 },
  { x: 297, y: 27, width: 64, height: 111 },
  { x: 373, y: 31, width: 64, height: 107 },
  { x: 449, y: 27, width: 64, height: 111 },
  { x: 525, y: 27, width: 64, height: 111 },
  { x: 601, y: 27, width: 64, height: 111 },
  { x: 677, y: 31, width: 64, height: 107 },
  { x: 753, y: 27, width: 76, height: 111 },
  { x: 841, y: 27, width: 76, height: 111 },
  { x: 929, y: 31, width: 76, height: 107 },
  { x: 1017, y: 31, width: 76, height: 107 },
];

export const SMB3_MARIO_FROG_FRAMES: SpriteFrame[] = [
  { x: 19, y: 72, width: 64, height: 64 },
  { x: 95, y: 56, width: 64, height: 80 },
  { x: 171, y: 52, width: 64, height: 84 },
  { x: 247, y: 40, width: 80, height: 96 },
  { x: 339, y: 20, width: 80, height: 116 },
  { x: 431, y: 20, width: 76, height: 116 },
  { x: 519, y: 8, width: 64, height: 124 },
  { x: 595, y: 12, width: 60, height: 124 },
  { x: 667, y: 12, width: 60, height: 124 },
  { x: 739, y: 16, width: 64, height: 120 },
  { x: 815, y: 12, width: 84, height: 124 },
  { x: 911, y: 44, width: 96, height: 88 },
  { x: 1015, y: 44, width: 96, height: 88 },
];

export const SMB3_GOOMBA_FRAMES: SpriteFrame[] = [
  { x: 9, y: 31, width: 90, height: 109 },
  { x: 107, y: 31, width: 91, height: 109 },
  { x: 206, y: 67, width: 73, height: 73 },
  { x: 287, y: 67, width: 73, height: 73 },
  { x: 367, y: 103, width: 73, height: 37 },
  { x: 448, y: 99, width: 37, height: 41 },
  { x: 493, y: 99, width: 37, height: 41 },
  { x: 538, y: 31, width: 91, height: 109 },
  { x: 637, y: 31, width: 90, height: 109 },
  { x: 735, y: 67, width: 73, height: 73 },
  { x: 816, y: 67, width: 73, height: 73 },
  { x: 897, y: 103, width: 73, height: 37 },
  { x: 977, y: 99, width: 37, height: 41 },
  { x: 1022, y: 99, width: 37, height: 41 },
];
export const SMB3_MINI_GOOMBA_FRAMES: SpriteFrame[] = [5, 6].map((index) => SMB3_GOOMBA_FRAMES[index]);
export const SMB3_GOOMBA_SQUASHED_FRAMES: SpriteFrame[] = [4, 11].map((index) => SMB3_GOOMBA_FRAMES[index]);

export const SMB3_KOOPA_FRAMES: SpriteFrame[] = [
  { x: 11, y: 48, width: 49, height: 81 },
  { x: 63, y: 45, width: 50, height: 84 },
  { x: 116, y: 79, width: 50, height: 50 },
  { x: 169, y: 79, width: 49, height: 50 },
  { x: 221, y: 80, width: 50, height: 49 },
  { x: 274, y: 80, width: 50, height: 49 },
  { x: 326, y: 80, width: 50, height: 49 },
  { x: 379, y: 80, width: 50, height: 49 },
  { x: 484, y: 48, width: 50, height: 81 },
  { x: 537, y: 45, width: 50, height: 84 },
  { x: 589, y: 79, width: 50, height: 50 },
  { x: 642, y: 79, width: 50, height: 50 },
  { x: 695, y: 80, width: 49, height: 49 },
  { x: 747, y: 80, width: 50, height: 49 },
  { x: 800, y: 80, width: 50, height: 49 },
  { x: 853, y: 80, width: 49, height: 49 },
  { x: 958, y: 58, width: 49, height: 71 },
  { x: 1010, y: 55, width: 50, height: 74 },
];
export const SMB3_PARATROOPA_FRAMES: SpriteFrame[] = [
  { x: 12, y: 6, width: 87, height: 146 },
  { x: 109, y: 6, width: 87, height: 146 },
  { x: 206, y: 6, width: 87, height: 146 },
  { x: 303, y: 6, width: 87, height: 146 },
];
export const SMB3_HAMMER_BRO_FRAMES: SpriteFrame[] = [
  { x: 30, y: 29, width: 80, height: 120 },
  { x: 115, y: 29, width: 80, height: 120 },
  { x: 200, y: 29, width: 80, height: 120 },
  { x: 285, y: 29, width: 80, height: 120 },
];
export const SMB3_HAMMER_FRAMES: SpriteFrame[] = [
  { x: 6, y: 12, width: 64, height: 56 },
  { x: 78, y: 12, width: 64, height: 56 },
  { x: 150, y: 12, width: 64, height: 56 },
  { x: 222, y: 12, width: 64, height: 56 },
];
export const SMB3_BOWSER_FRAMES: SpriteFrame[] = [
  { x: 33, y: 24, width: 102, height: 123 },
  { x: 180, y: 36, width: 102, height: 111 },
];
export const SMB3_BULLET_BILL: SpriteFrame = { x: 211, y: 9, width: 48, height: 42 };
export const SMB3_BULLET_BILL_CANNON: SpriteFrame = { x: 7, y: 6, width: 48, height: 45 };
export const SMB3_BUZZY_WALK_FRAMES: SpriteFrame[] = [0, 1].map((index) => ({
  x: index * 83,
  y: 0,
  width: 83,
  height: 80,
}));
export const SMB3_BUZZY_SHELL_FRAMES: SpriteFrame[] = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((index) => ({
  x: index * 83,
  y: 0,
  width: 83,
  height: 80,
}));
export const SMB3_BUZZY_CAVE_WALK_FRAMES = SMB3_BUZZY_WALK_FRAMES.map((frame) => ({
  ...frame,
  y: 80,
}));
export const SMB3_BUZZY_CAVE_SHELL_FRAMES = SMB3_BUZZY_SHELL_FRAMES.map((frame) => ({
  ...frame,
  y: 80,
}));
export const SMB3_CHEEP_CHEEP_FRAMES: SpriteFrame[] = [
  { x: 14, y: 3, width: 71, height: 68 },
  { x: 89, y: 3, width: 71, height: 68 },
  { x: 238, y: 3, width: 71, height: 68 },
  { x: 312, y: 3, width: 71, height: 68 },
];
export const SMB3_SPINY_FRAMES: SpriteFrame[] = [14, 89].map((x) => ({
  x,
  y: 72,
  width: 72,
  height: 76,
}));

export const SMB3_TILE_SPRITES: Partial<Record<number, SpriteFrame>> = {
  [Tile.floor]: { x: 157, y: 12, width: 64, height: 64 },
  [Tile.question]: { x: 77, y: 12, width: 64, height: 64 },
  [Tile.pipe_left_top]: { x: 5, y: 164, width: 64, height: 64 },
  [Tile.pipe_right_top]: { x: 69, y: 164, width: 64, height: 64 },
  [Tile.pipe_left_body]: { x: 5, y: 316, width: 64, height: 64 },
  [Tile.pipe_right_body]: { x: 69, y: 316, width: 64, height: 64 },
  [Tile.brick]: { x: 157, y: 92, width: 64, height: 64 },
  [Tile.hard]: { x: 157, y: 12, width: 64, height: 64 },
  [Tile.used]: { x: 157, y: 12, width: 64, height: 64 },
  [Tile.brick_coins]: { x: 157, y: 92, width: 64, height: 64 },
  [Tile.brick_star]: { x: 157, y: 92, width: 64, height: 64 },
  [Tile.brick_vine]: { x: 157, y: 92, width: 64, height: 64 },
};
export const SMB3_BIG_BLOCK_FRAME: SpriteFrame = { x: 833, y: 8, width: 128, height: 128 };
export const SMB3_NOTE_FRAMES: SpriteFrame[] = [
  { x: 5, y: 92, width: 64, height: 64 },
  { x: 77, y: 92, width: 64, height: 64 },
];
export const SMB3_COIN_FRAMES: SpriteFrame[] = [
  { x: 257, y: 12, width: 56, height: 64 },
  { x: 329, y: 12, width: 40, height: 64 },
  { x: 385, y: 12, width: 24, height: 64 },
  { x: 425, y: 12, width: 40, height: 64 },
  { x: 481, y: 12, width: 56, height: 64 },
];
export const SMB3_LAVA_FRAMES: SpriteFrame[] = [0, 1, 2, 3, 4].map((index) => ({
  x: 321 + index * 72,
  y: 232,
  width: 64,
  height: 64,
}));