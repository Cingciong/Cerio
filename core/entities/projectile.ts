// Player projectiles. Values: shared/game.json "projectiles".
// fireball: flies forward, bounces on the ground, dies on a wall, dies on the first enemy.
// hammer:   thrown in an arc, flies through tiles and through enemies (kills every enemy it touches).

import { Body } from "./body.ts";
import { PROJECTILES } from "../config/config.ts";
import { TILE_SUB } from "../config/constants.ts";
import type { TileMap } from "../world/tiles.ts";

export type ProjectileType = 'fireball' | 'hammer';

export class Projectile extends Body {
  readonly type: ProjectileType;
  alive = true;
  dir: -1 | 1;
  life: number; // frames left

  constructor(type: ProjectileType, x: number, y: number, dir: -1 | 1) {
    const cfg = PROJECTILES[type];
    super(x, y, cfg.w, cfg.h);
    this.type = type;
    this.dir = dir;
    this.life = cfg.lifeFrames;
    this.vx = dir * cfg.speed;
    this.vy = -cfg.throwVy; // hammer starts going up
  }

  update(map: TileMap): void {
    if (!this.alive) return;
    const cfg = PROJECTILES[this.type];

    this.vx = this.dir * cfg.speed; // move() zeroes vx on a wall, so set it every frame
    this.vy = Math.min(this.vy + cfg.gravity, cfg.maxFall);

    if (cfg.hitsTiles) {
      const hit = this.move(map);
      if (hit.wall) this.alive = false;
      else if (hit.ground) this.vy = -cfg.bounce;
    } else {
      this.x += this.vx;
      this.y += this.vy;
    }

    if (--this.life <= 0) this.alive = false;
    if (this.y > (map.height + 1) * TILE_SUB) this.alive = false;
  }
}
