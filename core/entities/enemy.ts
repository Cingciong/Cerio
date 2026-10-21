// Enemies are driven by Buttons, like the player.
// decide() is the controller: now a simple rule, later a small neural network
// (the server can return buttons per enemy id, see frame.ts).
// Size and physics per type: shared/game.json "enemies".

import { Body } from "./body.ts";
import { Button, has, type Buttons } from "../config/buttons.ts";
import { ENEMIES, PIRANHA, type EnemyConfig } from "../config/config.ts";
import { TILE_SUB, SUB } from "../config/constants.ts";
import { isSolid, toTile, type TileMap } from "../world/tiles.ts";


export type EnemyActionState = 'default' | 'shell_idle' | 'shell_sliding' | 'falling';

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

  update(buttons: Buttons, map: TileMap, player?: Body): void {
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
  private static readonly SHELL_DURATION_FRAMES = 300;
  private shellTimer = 0;
  private ceilingChecked = false;
  private droppingFromCeiling = false;
  onCeiling = false;

  constructor(id: number, type: string, x: number, y: number){
    super(id, type, x, y);
  }

  onStomp(playerX: number): boolean {
    const previousState = this.actionState;
    const shouldBounce = super.onStomp(playerX);

    if (this.actionState === 'shell_idle' && previousState !== 'shell_idle') {
      this.shellTimer = BuzzyBeetle.SHELL_DURATION_FRAMES;
    } else if (this.actionState === 'shell_sliding') {
      this.shellTimer = 0;
    }
    return shouldBounce;
  }

  update(buttons: Buttons, map: TileMap, player?: Body): void {
    if (!this.alive) return;

    if (!this.ceilingChecked) {
      this.ceilingChecked = true;
      const ceilingRow = toTile(this.y - 1);
      const centerTile = toTile(this.x + (this.w * SUB) / 2);
      if (isSolid(map, centerTile, ceilingRow)) {
        this.y = (ceilingRow + 1) * TILE_SUB;
        this.onCeiling = true;
      }
    }

    if (this.actionState === 'shell_idle' && this.shellTimer > 0) {
      this.shellTimer--;
      if (this.shellTimer === 0) {
        this.actionState = 'default';
        this.y -= (this.defaultHeight - this.h) * SUB;
        this.h = this.defaultHeight;
      }
    }

    if (this.onCeiling && player && player.y >= this.bottom && player.x < this.right && this.x < player.right) {
      this.onCeiling = false;
      this.droppingFromCeiling = true;
      this.actionState = 'falling';
    }

    if (this.onCeiling) {
      if (has(buttons, Button.left)) this.dir = -1;
      if (has(buttons, Button.right)) this.dir = 1;

      if (this.actionState === 'shell_idle') {
        this.vx = 0;
      } else {
        const speed = this.actionState === 'shell_sliding' ? this.cfg.speed * 3 : this.cfg.speed;
        const nextEdge = this.dir > 0 ? this.right + speed - 1 : this.x - speed;
        const ceilingRow = toTile(this.y - 1);
        if (!isSolid(map, toTile(nextEdge), ceilingRow)) this.dir = -this.dir;
        this.vx = this.dir * speed;
      }

      this.vy = 0;
      const hit = this.move(map);
      if (hit.wall) this.dir = -this.dir;
      return;
    }

    if (this.droppingFromCeiling) {
      this.vx = 0;
      this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);
      const hit = this.move(map);
      if (hit.ground) {
        this.droppingFromCeiling = false;
        this.actionState = 'default';
      }
      if (this.y > (map.height + 1) * TILE_SUB) this.alive = false;
      return;
    }

    super.update(buttons, map);
  }
}

export class Spiny extends KoopaEnemy {
  private ceilingChecked = false;
  private onCeiling = false;

  constructor(id: number, type: string, x: number, y: number) {
    super(id, type, x, y);
    this.stompable = false;
  }

  onStomp(playerX: number): boolean {
    if (!this.stompable) return false;
    return super.onStomp(playerX);
  }

  update(buttons: Buttons, map: TileMap, player?: Body): void {
    if (!this.alive) return;

    if (!this.ceilingChecked) {
      this.ceilingChecked = true;
      const ceilingRow = toTile(this.y - 1);
      const centerTile = toTile(this.x + (this.w * SUB) / 2);
      if (isSolid(map, centerTile, ceilingRow)) {
        this.y = (ceilingRow + 1) * TILE_SUB;
        this.onCeiling = true;
      }
    }

    if (this.onCeiling && player && player.y >= this.bottom && player.x < this.right && this.x < player.right) {
      this.onCeiling = false;
      this.actionState = 'falling';
    }

    if (this.onCeiling) {
      if (has(buttons, Button.left)) this.dir = -1;
      if (has(buttons, Button.right)) this.dir = 1;

      const nextEdge = this.dir > 0 ? this.right + this.cfg.speed - 1 : this.x - this.cfg.speed;
      const ceilingRow = toTile(this.y - 1);
      if (!isSolid(map, toTile(nextEdge), ceilingRow)) this.dir = -this.dir;

      this.vx = this.dir * this.cfg.speed;
      this.vy = 0;
      const hit = this.move(map);
      if (hit.wall) this.dir = -this.dir;
      return;
    }

    if (this.actionState === 'falling') {
      this.vx = 0;
      this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);
      const hit = this.move(map);
      if (hit.ground) {
        this.actionState = 'shell_sliding';
        this.stompable = true;
      }
      if (this.y > (map.height + 1) * TILE_SUB) this.alive = false;
      return;
    }

    super.update(buttons, map);
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


export interface HammerProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export type HammerBroState = 'idle' | 'moving' | 'jumping' | 'falling' | 'throwing';

export class HammerBro extends Enemy {
  readonly hammers: HammerProjectile[] = [];

  state: HammerBroState = 'idle';

  private decisionTimer = 0;
  private currentAction: Buttons = 0;
  private shouldJump = false;
  private shouldThrow = false;

  private static readonly JUMP_SPEED = 80;
  private static readonly DECISION_TIME = 40;

  private static readonly HAMMER_SIZE = 8 * SUB;
  private static readonly HAMMER_VX = 24;
  private static readonly HAMMER_VY = -48;
  private static readonly HAMMER_GRAVITY = 3;
  private static readonly HAMMER_MAX_FALL = 48;

  constructor(id: number, type: string, x: number, y: number) {
    super(id, type, x, y);
  }

  decide(_map: TileMap, _player?: Body): Buttons {
    if (this.decisionTimer <= 0) {
      const action = Math.floor(Math.random() * 5);

      switch (action) {
        case 0:
          this.currentAction = Button.left;
          break;
        case 1:
          this.currentAction = Button.right;
          break;
        case 2:
          this.currentAction = 0;
          break;
        case 3:
          this.currentAction = 0;
          this.shouldJump = true;
          break;
        case 4:
          this.currentAction = 0;
          this.shouldThrow = true;
          break;
      }

      this.decisionTimer = HammerBro.DECISION_TIME
    }

    this.decisionTimer--;
    return this.currentAction;
  }

  update(buttons: Buttons, map: TileMap): void {
    if (!this.alive) return;

    this.buttons = buttons;

    if (has(buttons, Button.left)) this.dir = -1;
    if (has(buttons, Button.right)) this.dir = 1;

    this.vx = has(buttons, Button.left | Button.right) ? this.dir * this.cfg.speed : 0;
    this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);

    const hit = this.move(map);

    if (hit.wall) {
      this.dir = -this.dir;
    }

    if (this.shouldJump && hit.ground) {
      this.vy = -HammerBro.JUMP_SPEED;
      this.shouldJump = false;
    }

    const throwing = this.shouldThrow;

    if (throwing) {
      this.throwHammer();
      this.shouldThrow = false;
    }

    this.updateHammers(map);

    if (throwing) {
      this.state = 'throwing';
    } else if (this.vy < 0) {
      this.state = 'jumping';
    } else if (this.vy > 0) {
      this.state = 'falling';
    } else if (this.vx !== 0) {
      this.state = 'moving';
    } else {
      this.state = 'idle';
    }

    if (this.y > (map.height + 1) * TILE_SUB) {
      this.alive = false;
    }
  }

  private throwHammer(): void {
    const size = HammerBro.HAMMER_SIZE;

    this.hammers.push({
      x: this.x + (this.dir > 0 ? this.w * SUB : -size),
      y: this.y + (this.h * SUB) / 4,
      vx: this.dir * HammerBro.HAMMER_VX,
      vy: HammerBro.HAMMER_VY,
      alive: true
    });
  }

  private updateHammers(map: TileMap): void {
    const size = HammerBro.HAMMER_SIZE;

    for (const hammer of this.hammers) {
      if (!hammer.alive) continue;

      hammer.x += hammer.vx;
      hammer.y += hammer.vy;

      hammer.vy = Math.min(hammer.vy + HammerBro.HAMMER_GRAVITY, HammerBro.HAMMER_MAX_FALL);

      if (hammer.x + size < 0 || hammer.x > map.width * TILE_SUB || hammer.y > map.height * TILE_SUB) {
        hammer.alive = false;
      }
    }

    for (let i = this.hammers.length - 1; i >= 0; i--) {
      if (!this.hammers[i].alive) {
        this.hammers.splice(i, 1);
      }
    }
  }
}


export function createEnemy(id: number, type: string, x: number, y: number): Enemy {
    switch (type){
      case 'goomba':
        return new Goomba(id, type, x, y);
      case 'buzzy_beetle':
        return new BuzzyBeetle(id, type, x, y);
      case 'spiny':
        return new Spiny(id, type, x, y);
      case 'koopa_para':
      case 'koopa_para_red':
        return new KoopaParaTroopa(id, type, x, y);
      case 'koopa':
      case 'koopa_red':
        return new KoopaEnemy(id, type, x, y);
      case 'piranha':
        return new PiranhaPlant(id, type, x, y);
      case 'hammer_bro':
        return new HammerBro(id, type, x, y);
      default:
        return new Enemy(id, type, x, y);
    }
}