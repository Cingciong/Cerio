// Enemies are driven by Buttons, like the player.
// decide() is the controller: now a simple rule, later a small neural network
// (the server can return buttons per enemy id, see frame.ts).
// Size and physics per type: shared/game.json "enemies".

import { Body } from "./body.ts";
import { Button, has, type Buttons } from "./buttons.ts";
import { ENEMIES, PIRANHA, type EnemyConfig } from "./config.ts";
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
  stompable = true;

  actionState: EnemyActionState = 'default';

  constructor(id: number, type: string, x: number, y: number) {
    const cfg = ENEMIES[type];
    super(x, y, cfg.w, cfg.h);
    this.cfg = cfg;
    this.id = id;
    this.type = type;
  }

  /** Default controller: walk, turn around at walls. */
  decide(map: TileMap, player?: Body): Buttons {
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

export class Goomba extends Enemy {
  constructor(id: number, type: string, x: number, y: number){
    super(id, type, x, y);
  }

}
export class BuzzyBeetle extends KoopaEnemy {
  constructor(id: number, type: string, x: number, y: number){
    super(id, type, x, y);
  }
}
export class KoopaParaTroopa extends KoopaEnemy {
  hasWings = true;
  vDir = -1; 

  constructor(id: number, type: string, x: number, y: number){
    super(id, type, x, y);
  }

  onStomp(playerX: number): boolean {
    if (this.hasWings) {
      this.hasWings = false;
      return true; 
    } else {
      return super.onStomp(playerX);
    }
  }

  decide(map: TileMap): Buttons {
    if (this.hasWings) {
      if (this.type === 'koopa_para_red') {
        return this.vDir < 0 ? Button.jump : Button.down; 
      } else {
        return this.dir < 0 ? Button.left : Button.right;
      }
    }
    return super.decide(map);
  }

  update(buttons: Buttons, map: TileMap): void {
    if (!this.alive) return;
    
    if (!this.hasWings) {
      super.update(buttons, map);
      return;
    }
    if (this.type === 'koopa_para_red') {
      if (has(buttons, Button.jump)) this.vDir = -1;
      if (has(buttons, Button.down)) this.vDir = 1;
      
      this.vx = 0;
      this.vy = has(buttons, Button.jump | Button.down) ? this.vDir * this.cfg.speed : 0;
    } else {
      if (has(buttons, Button.left)) this.dir = -1;
      if (has(buttons, Button.right)) this.dir = 1;
      
      this.vx = has(buttons, Button.left | Button.right) ? this.dir * this.cfg.speed : 0;
      this.vy = 0; 
    }
    const hit = this.move(map);

    if (this.type === 'koopa_para_red') {
      if (hit.ceiling || hit.ground) {
         this.vDir = -this.vDir;
      }
    } else {
      if (hit.wall) {
         this.dir = -this.dir;
      }
    }

    if (this.y > (map.height + 1) * TILE_SUB) this.alive = false;
  }
}



export type PiranhaPhase = 'hidden' | 'rising' | 'up' | 'sinking';

export class PiranhaPlant extends Enemy {
  readonly topY: number;
  readonly bottomY: number;
  phase: PiranhaPhase = 'hidden';
  timer = 0;

  constructor(id: number, type: string, x: number, y: number) {
    super(id, type, x, y);
    this.stompable = false;
    this.topY = y + TILE_SUB - this.h * SUB;
    this.bottomY = this.topY + this.h * SUB;
    this.y = this.bottomY;
  }

  onStomp(playerX: number): boolean {
    return false;
  }

  decide(map: TileMap, player?: Body): Buttons {
    switch (this.phase) {
      case 'hidden':
        this.timer++;
        if (this.timer >= PIRANHA.hiddenFrames && !this.playerNear(player)) {
          this.phase = 'rising';
          this.timer = 0;
        }
        break;
      case 'rising':
        if (this.y <= this.topY) {
          this.phase = 'up';
          this.timer = 0;
        }
        break;
      case 'up':
        this.timer++;
        if (this.timer >= PIRANHA.upFrames) {
          this.phase = 'sinking';
          this.timer = 0;
        }
        break;
      case 'sinking':
        if (this.y >= this.bottomY) {
          this.phase = 'hidden';
          this.timer = 0;
        }
        break;
    }
    if (this.phase === 'rising') return Button.jump;
    if (this.phase === 'sinking') return Button.down;
    return 0;
  }

  update(buttons: Buttons, map: TileMap): void {
    if (!this.alive) return;
    this.buttons = buttons;
    const before = this.y;
    const dy = has(buttons, Button.jump) ? -this.cfg.speed : has(buttons, Button.down) ? this.cfg.speed : 0;
    this.y = Math.max(this.topY, Math.min(this.bottomY, this.y + dy));
    this.vx = 0;
    this.vy = this.y - before;
  }

  private playerNear(player?: Body): boolean {
    if (!player) return false;
    const plantCentre = this.x + (this.w * SUB) / 2;
    const playerCentre = player.x + (player.w * SUB) / 2;
    return Math.abs(playerCentre - plantCentre) < PIRANHA.safeRadiusPx * SUB;
  }
}


export function createEnemy(id: number, type: string, x: number, y: number): Enemy {
    switch (type){
      case 'goomba':
        return new Goomba(id, type, x, y);
      case 'buzzy_beetle':
        return new BuzzyBeetle(id, type, x, y);
      case 'koopa_para':
      case 'koopa_para_red':
        return new KoopaParaTroopa(id, type, x, y);
      case 'koopa':
      case 'koopa_red':
        return new KoopaEnemy(id, type, x, y);
      case 'piranha':
        return new PiranhaPlant(id, type, x, y);
      default:
        return new Enemy(id, type, x, y);
    }
}