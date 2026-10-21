import { Body } from "./body.ts";
import { PROJECTILES } from "../config/config.ts";
import { TILE_SUB } from "../config/constants.ts";
import type { TileMap } from "../world/tiles.ts";

export type ProjectileType = 'fireball';

export class Projectile extends Body {
  readonly type: ProjectileType;
  alive = true;
  dir: -1 | 1;
  life: number; 

  constructor(type: ProjectileType, x: number, y: number, dir: -1 | 1) {
    const cfg = PROJECTILES[type];
    super(x, y, cfg.w, cfg.h);
    this.type = type;
    this.dir = dir;
    this.life = cfg.lifeFrames;
    this.vx = dir * cfg.speed;
  }

  update(map: TileMap): void {
    if (!this.alive) return;
    const cfg = PROJECTILES[this.type];

    this.vx = this.dir * cfg.speed; 
    this.vy = Math.min(this.vy + cfg.gravity, cfg.maxFall);

    const hit = this.move(map);
    if (hit.wall) this.alive = false;
    else if (hit.ground) this.vy = -cfg.bounce;

    if (--this.life <= 0) this.alive = false;
    if (this.y > (map.height + 1) * TILE_SUB) this.alive = false;
  }
}
