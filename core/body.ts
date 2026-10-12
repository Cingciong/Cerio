// Axis-aligned hitbox moving through the tile map. Base class for the player and enemies.

import { SUB, TILE_SUB } from "./constants.ts";
import { isSolid, toTile, type TileMap } from "./tiles.ts";

export interface Collision {
  wall: boolean; // hit something while moving horizontally
  ceiling: boolean;
  ground: boolean; // standing on something after this move
}

export class Body {
  x: number; // subpixels, top-left
  y: number;
  vx = 0; // subpixels per frame
  vy = 0;
  w: number; // px
  h: number;
  onGround = false;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  get right(): number {
    return this.x + this.w * SUB;
  }

  get bottom(): number {
    return this.y + this.h * SUB;
  }

  overlaps(o: Body): boolean {
    return this.x < o.right && o.x < this.right && this.y < o.bottom && o.y < this.bottom;
  }

  /** Move by (vx, vy): first X, then Y. Speeds stay below one tile per frame, so no tunnelling. */
  move(map: TileMap): Collision {
    const hit: Collision = { wall: false, ceiling: false, ground: false };

    // X
    this.x += this.vx;
    if (this.vx !== 0) {
      const tx = this.vx > 0 ? toTile(this.right - 1) : toTile(this.x);
      if (this.columnSolid(map, tx)) {
        this.x = this.vx > 0 ? tx * TILE_SUB - this.w * SUB : (tx + 1) * TILE_SUB;
        this.vx = 0;
        hit.wall = true;
      }
    }

    // Y
    this.y += this.vy;
    if (this.vy !== 0) {
      const ty = this.vy > 0 ? toTile(this.bottom - 1) : toTile(this.y);
      if (this.rowSolid(map, ty)) {
        if (this.vy > 0) {
          this.y = ty * TILE_SUB - this.h * SUB;
        } else {
          this.y = (ty + 1) * TILE_SUB;
          hit.ceiling = true;
        }
        this.vy = 0;
      }
    }

    hit.ground = this.rowSolid(map, toTile(this.bottom)); // tile row just below the feet
    this.onGround = hit.ground && this.vy >= 0;
    return hit;
  }

  private columnSolid(map: TileMap, tx: number): boolean {
    for (let ty = toTile(this.y); ty <= toTile(this.bottom - 1); ty++) {
      if (isSolid(map, tx, ty)) return true;
    }
    return false;
  }

  private rowSolid(map: TileMap, ty: number): boolean {
    for (let tx = toTile(this.x); tx <= toTile(this.right - 1); tx++) {
      if (isSolid(map, tx, ty)) return true;
    }
    return false;
  }
}
