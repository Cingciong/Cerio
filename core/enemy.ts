// Enemies are driven by Buttons, like the player.
// decide() is the controller: now a simple rule, later a small neural network
// (the server can return buttons per enemy id, see frame.ts).
// Size and physics per type: shared/game.json "enemies".

import { Body } from "./body.ts";
import { Button, has, type Buttons } from "./buttons.ts";
import { ENEMIES, type EnemyConfig } from "./config.ts";
import { TILE_SUB, SUB } from "./constants.ts";
import { isSolid, toTile, type TileMap } from "./tiles.ts";


export type EnemyActionState = 'default' | 'shell_idle' | 'shell_sliding';

export class Enemy extends Body {
  readonly id: number;
  readonly type: string;
  readonly cfg: EnemyConfig;
  alive = true;
  dir = -1; // -1 left, 1 right
  buttons: Buttons = 0;

  actionState: EnemyActionState = 'default';

  constructor(id: number, type: string, x: number, y: number) {
    const cfg = ENEMIES[type];
    super(x, y, cfg.w, cfg.h);
    this.cfg = cfg;
    this.id = id;
    this.type = type;
  }

  /** Default controller: walk, turn around at walls. */
  decide(map: TileMap): Buttons {
    return this.dir < 0 ? Button.left : Button.right;
  }

  onStomp(playerX: number): boolean {
    this.alive = false;
    return true;
  }

  update(buttons: Buttons, map: TileMap): void {
    if (!this.alive) return;
    this.buttons = buttons;

    if (has(buttons, Button.left)) this.dir = -1;
    if (has(buttons, Button.right)) this.dir = 1;
    this.vx = has(buttons, Button.left | Button.right) ? this.dir * this.cfg.speed : 0;
    this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);

    const hit = this.move(map);
    if (hit.wall) this.dir = -this.dir;
    if (this.y > (map.height + 1) * TILE_SUB) this.alive = false; // fell into a pit
  }
}


export class KoopaEnemy extends Enemy {

  readonly defaultHeight: number;

  constructor(id: number, type: string, x: number, y: number){
    super(id, type, x, y);
    this.defaultHeight = this.h;
  }

  onStomp(playerX: number): boolean {
    if(this.actionState === 'default'){
      this.actionState = 'shell_idle';
      this.vx = 0;
      const oldH = this.h;
      this.h = 16;
      this.y += (oldH - this.h)*SUB;
      return true;
    }else if (this.actionState === 'shell_idle'){
      this.actionState = 'shell_sliding';
      const playerCenterX = playerX;
      this.dir = (playerCenterX < this.x + (this.w / 2)) ? 1 : -1;
      return false;
    }else if (this.actionState === 'shell_sliding'){
      this.actionState = 'shell_idle';
      this.vx = 0;
      return true; 
    }
    return true;
  }

  decide(map: TileMap): Buttons {
    if (this.actionState === 'shell_idle'){
      return 0;
    }

    if (this.actionState === 'shell_sliding'){
      return this.dir < 0 ? Button.left : Button.right;
    }

    if (this.type === 'koopa_red' && this.actionState === 'default'){
      const forwardEdgeX = this.dir === 1 ? this.x + (this.w*SUB) - 1 : this.x;
      const tileBelowY = this.y + (this.h*SUB)+SUB;

      const tx = toTile(forwardEdgeX);
      const ty = toTile(tileBelowY);
      
      if (this.vy === 0 && !isSolid(map, tx, ty)){
        this.dir = -this.dir;
      }
    }
    return this.dir < 0 ? Button.left : Button.right;
  }

  update(buttons: Buttons, map: TileMap): void {
    if (!this.alive) return;
    this.buttons = buttons;

    if(this.actionState === 'shell_sliding'){
      const shellSpeed =  this.cfg.speed * 3;
      this.vx = this.dir * shellSpeed;
    }else if (this.actionState === 'shell_idle'){
      this.vx = 0;
    }else{
      this.vx = this.dir * this.cfg.speed;
    }
    this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);

    const previousDir = this.dir;

    const hit = this.move(map);

    if(hit.wall){
      this.dir = -previousDir;
    }

    if (this.y > (map.height + 1) * TILE_SUB) this.alive = false;
  }
}


export function createEnemy(id: number, type: string, x: number, y: number): Enemy {
    switch (type){
      case 'koopa':
      case 'koopa_red':
        return new KoopaEnemy(id, type, x, y);
      default:
        return new Enemy(id, type, x, y);
    }
}