import { Body } from "./body.ts";
import { TILE_SUB, SUB } from "../config/constants.ts";
import type { TileMap } from "../world/tiles.ts";

export type ItemType = 'mushroom' | 'star' | 'flower' | 'leaf';

export class Item extends Body {
  readonly id: number;
  readonly type: ItemType;
  alive = true;
  dir = 1;

  spawning = true;
  spawnY: number;

  constructor(id: number, type: ItemType, x: number, y: number) {
    super(x, y, 16, 16);
    this.id = id;
    this.type = type;
    this.spawnY = y - 16 * SUB;
  }

  update(map: TileMap): void {
    if (!this.alive) return;

    if (this.spawning) {
      this.y -= 0.5 * SUB;
      if (this.y <= this.spawnY) {
        this.y = this.spawnY;
        this.spawning = false;
      }
      return;
    }

    if (this.type === 'flower' || this.type === 'leaf') {
      return;
    }

    this.vy = Math.min(this.vy + 6, 64);
    this.vx = this.dir * (this.type === 'star' ? 16 : 10); 

    const hit = this.move(map);
    if (hit.wall) {
      this.dir = -this.dir;
    }
    
    if (hit.ground && this.type === 'star') {
        this.vy = -40;
    }

    if (this.y > (map.height + 1) * TILE_SUB) this.alive = false;
  }
}