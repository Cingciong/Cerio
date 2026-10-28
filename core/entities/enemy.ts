// Enemies are driven by Buttons, like the player.
// decide() is the controller: now a simple rule, later a small neural network
// (the server can return buttons per enemy id, see frame.ts).
// Size and physics per type: shared/game.json "enemies".

import { Body } from "./body.ts";
import { Button, has, type Buttons } from "../config/buttons.ts";
import { ENEMIES, PIRANHA, type EnemyConfig } from "../config/config.ts";
import { TILE_SUB, SUB } from "../config/constants.ts";
import { isSolid, toTile, type TileMap } from "../world/tiles.ts";

export type EnemyController = (enemy: Enemy, map: TileMap, player?: Body) => Buttons | undefined;
export type EnemyActionState = 'default' | 'shell_idle' | 'shell_sliding' | 'falling';

export class Enemy extends Body {
  readonly id: number;
  type: string;
  readonly cfg: EnemyConfig;
  alive = true;
  dir = -1; // -1 left, 1 right
  buttons: Buttons = 0;
  stompable = true;

  actionState: EnemyActionState = 'default';

  protected externalController?: EnemyController;

  constructor(id: number, type: string, x: number, y: number) {
    const cfg = ENEMIES[type];
    super(x, y, cfg.w, cfg.h);
    this.cfg = cfg;
    this.id = id;
    this.type = type;
  }

  setController(controller: EnemyController): void {
    this.externalController = controller;
  }

  /** Default controller: walk, turn around at walls. */
  decide(map: TileMap, player?: Body): Buttons {
    if (this.externalController) {
      const extButtons = this.externalController(this, map, player);
      if (extButtons !== undefined) return extButtons;
    }
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
    if (this.externalController) {
      const extButtons = this.externalController(this, map, undefined);
      if (extButtons !== undefined) return extButtons;
    }

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
  stackCount: number;

  constructor(id: number, type: string, x: number, y: number, stackCount = 1) {
    super(id, type, x, y);
    if (!Number.isInteger(stackCount) || stackCount < 1) {
      throw new Error("Goomba stack count must be a positive integer");
    }
    this.stackCount = stackCount;
    this.y -= (stackCount - 1) * this.cfg.h * SUB;
    this.h = stackCount * this.cfg.h;
  }

  onStomp(playerX: number): boolean {
    if (this.stackCount > 1) {
      this.stackCount--;
      this.y += this.cfg.h * SUB;
      this.h -= this.cfg.h;
    } else {
      this.alive = false;
    }
    return true;
  }

}

export class MiniGoomba extends Enemy {
  constructor(id: number, x: number, y: number) {
    super(id, "mini_goomba", x, y);
    this.stompable = false;
  }

  update(_buttons: Buttons, map: TileMap): void {
    if (!this.alive) return;
    this.vy = Math.min(this.vy + 2, 48);
    this.y += this.vy;
    if (this.y > (map.height + 1) * TILE_SUB) {
      this.alive = false;
    }
  }
}

export abstract class ParaGoomba extends Goomba {
  hasWings = true;

  constructor(id: number, type: string, x: number, y: number) {
    super(id, type, x, y, 1);
  }

  onStomp(playerX: number): boolean {
    if (this.hasWings) {
      this.hasWings = false;
      this.type = "goomba";
      return true;
    }
    return super.onStomp(playerX);
  }
}

export class ParaGoombaRed extends ParaGoomba {
  static readonly HOP_VY = 36;
  static readonly HIGH_JUMP_VY = 68;
  static readonly WALK_DURATION = 90;
  static readonly GROUND_DELAY = 10;

  state: 'walking' | 'ground_pause' | 'jumping' = 'walking';
  walkTimer = ParaGoombaRed.WALK_DURATION;
  jumpCount = 0;
  groundDelay = 0;

  constructor(id: number, type = "para_goomba_red", x: number, y: number) {
    super(id, type, x, y);
  }

  decide(map: TileMap, player?: Body): Buttons {
    if (this.externalController) {
      const extButtons = this.externalController(this, map, player);
      if (extButtons !== undefined) return extButtons;
    }
    if (!this.hasWings) {
      return super.decide(map, player);
    }
    if (this.state === 'ground_pause') return 0;
    return this.dir < 0 ? Button.left : Button.right;
  }

  update(buttons: Buttons, map: TileMap, player?: Body): void {
    if (!this.alive) return;
    this.buttons = buttons;

    if (!this.hasWings) {
      super.update(buttons, map, player);
      return;
    }

    if (this.state === 'walking') {
      if (has(buttons, Button.left)) this.dir = -1;
      if (has(buttons, Button.right)) this.dir = 1;

      this.vx = has(buttons, Button.left | Button.right) ? this.dir * this.cfg.speed : 0;
      this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);

      const hit = this.move(map);
      if (hit.wall) this.dir = -this.dir;
      if (hit.ground) {
        this.walkTimer--;
        if (this.walkTimer <= 0) {
          this.state = 'ground_pause';
          this.groundDelay = ParaGoombaRed.GROUND_DELAY;
          this.jumpCount = 1;
        }
      }
    } else if (this.state === 'ground_pause') {
      this.vx = 0;
      this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);
      this.move(map);

      this.groundDelay--;
      if (this.groundDelay <= 0) {
        if (player) {
          const playerCenter = player.x + (player.w * SUB) / 2;
          const myCenter = this.x + (this.w * SUB) / 2;
          this.dir = playerCenter >= myCenter ? 1 : -1;
        }
        this.vy = this.jumpCount === 3 ? -ParaGoombaRed.HIGH_JUMP_VY : -ParaGoombaRed.HOP_VY;
        this.state = 'jumping';
      }
    } else if (this.state === 'jumping') {
      this.vx = this.dir * this.cfg.speed;
      this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);

      const hit = this.move(map);
      if (hit.wall) this.dir = -this.dir;
      if (hit.ground && this.vy >= 0) {
        if (this.jumpCount < 3) {
          this.jumpCount++;
          this.state = 'ground_pause';
          this.groundDelay = ParaGoombaRed.GROUND_DELAY;
        } else {
          this.jumpCount = 0;
          this.state = 'walking';
          this.walkTimer = ParaGoombaRed.WALK_DURATION;
        }
      }
    }

    if (this.y > (map.height + 1) * TILE_SUB) this.alive = false;
  }
}

export class ParaGoombaBrown extends ParaGoomba {
  static readonly WALK_DURATION = 100;
  static readonly TAKEOFF_DURATION = 40;
  static readonly FLY_DURATION = 160;
  static readonly TURN_INTERVAL = 40;
  static readonly DROP_INTERVAL = 50;
  static readonly TAKEOFF_SPEED = 18;

  state: 'walking' | 'takeoff' | 'flying' | 'descending' = 'walking';
  walkTimer = ParaGoombaBrown.WALK_DURATION;
  takeoffTimer = 0;
  flyTimer = 0;
  turnTimer = 0;
  dropTimer = 0;
  pendingMiniGoombas = false;

  constructor(id: number, type = "para_goomba", x: number, y: number) {
    super(id, type, x, y);
  }

  takeMiniGoomba(id: number): MiniGoomba | undefined {
    if (!this.pendingMiniGoombas || !this.hasWings || !this.alive) return undefined;
    this.pendingMiniGoombas = false;
    return new MiniGoomba(id, this.x + 4 * SUB, this.bottom);
  }

  decide(map: TileMap, player?: Body): Buttons {
    if (this.externalController) {
      const extButtons = this.externalController(this, map, player);
      if (extButtons !== undefined) return extButtons;
    }
    if (!this.hasWings) {
      return super.decide(map, player);
    }
    return this.dir < 0 ? Button.left : Button.right;
  }

  update(buttons: Buttons, map: TileMap, player?: Body): void {
    if (!this.alive) return;
    this.buttons = buttons;

    if (!this.hasWings) {
      super.update(buttons, map, player);
      return;
    }

    if (this.state === 'walking') {
      if (has(buttons, Button.left)) this.dir = -1;
      if (has(buttons, Button.right)) this.dir = 1;

      this.vx = has(buttons, Button.left | Button.right) ? this.dir * this.cfg.speed : 0;
      this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);

      const hit = this.move(map);
      if (hit.wall) this.dir = -this.dir;
      if (hit.ground) {
        this.walkTimer--;
        if (this.walkTimer <= 0) {
          this.state = 'takeoff';
          this.takeoffTimer = ParaGoombaBrown.TAKEOFF_DURATION;
          this.vy = -ParaGoombaBrown.TAKEOFF_SPEED;
        }
      }
    } else if (this.state === 'takeoff') {
      this.vy = -ParaGoombaBrown.TAKEOFF_SPEED;
      this.vx = this.dir * (this.cfg.speed / 2);

      const hit = this.move(map);
      if (hit.wall) this.dir = -this.dir;
      this.takeoffTimer--;
      if (this.takeoffTimer <= 0 || hit.ceiling) {
        this.state = 'flying';
        this.vy = 0;
        this.flyTimer = ParaGoombaBrown.FLY_DURATION;
        this.turnTimer = ParaGoombaBrown.TURN_INTERVAL;
        this.dropTimer = ParaGoombaBrown.DROP_INTERVAL;
      }
    } else if (this.state === 'flying') {
      this.vy = 0;
      this.vx = this.dir * this.cfg.speed;

      const hit = this.move(map);
      if (hit.wall) this.dir = -this.dir;

      this.turnTimer--;
      if (this.turnTimer <= 0) {
        this.dir = -this.dir;
        this.turnTimer = ParaGoombaBrown.TURN_INTERVAL;
      }

      this.dropTimer--;
      if (this.dropTimer <= 0) {
        this.pendingMiniGoombas = true;
        this.dropTimer = ParaGoombaBrown.DROP_INTERVAL;
      }

      this.flyTimer--;
      if (this.flyTimer <= 0) {
        this.state = 'descending';
        this.vy = this.cfg.gravity;
      }
    } else if (this.state === 'descending') {
      this.vx = this.dir * this.cfg.speed;
      this.vy = Math.min(this.vy + this.cfg.gravity, this.cfg.maxFall);

      const hit = this.move(map);
      if (hit.wall) this.dir = -this.dir;
      if (hit.ground) {
        this.state = 'walking';
        this.walkTimer = ParaGoombaBrown.WALK_DURATION;
      }
    }

    if (this.y > (map.height + 1) * TILE_SUB) this.alive = false;
  }
}

export class BulletBill extends Enemy {
  constructor(id: number, x: number, y: number) {
    super(id, "bullet_bill", x, y);
    this.dir = -1;
  }

  update(_buttons: Buttons, map: TileMap): void {
    if (!this.alive) return;
    this.vx = this.dir * this.cfg.speed;
    this.x += this.vx;
    if (this.right < 0 || this.x > map.width * TILE_SUB) this.alive = false;
  }
}

export class BulletBillCannon extends Enemy {
  private static readonly SHOT_INTERVAL_FRAMES = 180;
  private shotTimer = BulletBillCannon.SHOT_INTERVAL_FRAMES;
  private shotReady = false;

  constructor(id: number, x: number, y: number) {
    super(id, "bullet_bill_cannon", x, y);
    this.stompable = false;
  }

  update(): void {
    if (!this.alive) return;
    if (this.shotTimer > 0) this.shotTimer--;
    if (this.shotTimer === 0) {
      this.shotReady = true;
      this.shotTimer = BulletBillCannon.SHOT_INTERVAL_FRAMES;
    }
  }

  takeShot(id: number): BulletBill | undefined {
    if (!this.shotReady || !this.alive) return undefined;
    this.shotReady = false;
    return new BulletBill(id, this.x - ENEMIES.bullet_bill.w * SUB, this.y);
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
    if (this.externalController) {
      const extButtons = this.externalController(this, map, undefined);
      if (extButtons !== undefined) return extButtons;
    }
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

  /** Back into the pipe at once, e.g. when the player comes out of it. */
  hide(): void {
    this.phase = 'hidden';
    this.timer = 0;
    this.y = this.bottomY;
    this.vy = 0;
  }

  decide(map: TileMap, player?: Body): Buttons {
    if (this.externalController) {
      const extButtons = this.externalController(this, map, player);
      if (extButtons !== undefined) return extButtons;
    }
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

  static readonly HAMMER_WIDTH = 12 * SUB;
  static readonly HAMMER_HEIGHT = 16 * SUB;
  private static readonly HAMMER_VX = 24;
  private static readonly HAMMER_VY = -48;
  private static readonly HAMMER_GRAVITY = 3;
  private static readonly HAMMER_MAX_FALL = 48;

  constructor(id: number, type: string, x: number, y: number) {
    super(id, type, x, y);
  }

  decide(_map: TileMap, _player?: Body): Buttons {
    if (this.externalController) {
      const extButtons = this.externalController(this, _map, _player);
      if (extButtons !== undefined) return extButtons;
    }
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
    this.hammers.push({
      x: this.x + (this.dir > 0 ? this.w * SUB : -HammerBro.HAMMER_WIDTH),
      y: this.y + (this.h * SUB) / 4,
      vx: this.dir * HammerBro.HAMMER_VX,
      vy: HammerBro.HAMMER_VY,
      alive: true
    });
  }

  private updateHammers(map: TileMap): void {
    for (const hammer of this.hammers) {
      if (!hammer.alive) continue;

      hammer.x += hammer.vx;
      hammer.y += hammer.vy;

      hammer.vy = Math.min(hammer.vy + HammerBro.HAMMER_GRAVITY, HammerBro.HAMMER_MAX_FALL);

      if (
        hammer.x + HammerBro.HAMMER_WIDTH < 0 ||
        hammer.x > map.width * TILE_SUB ||
        hammer.y > map.height * TILE_SUB
      ) {
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


export function createEnemy(id: number, type: string, x: number, y: number, count = 1): Enemy {
    switch (type){
      case 'goomba':
        return new Goomba(id, type, x, y, count);
      case 'para_goomba':
      case 'para_goomba_brown':
      case 'goomba_para':
      case 'paragoomba':
        return new ParaGoombaBrown(id, type, x, y);
      case 'para_goomba_red':
      case 'goomba_para_red':
      case 'paragoomba_red':
        return new ParaGoombaRed(id, type, x, y);
      case 'mini_goomba':
      case 'micro_goomba':
        return new MiniGoomba(id, x, y);
      case 'bullet_bill':
        return new BulletBill(id, x, y);
      case 'bullet_bill_cannon':
        return new BulletBillCannon(id, x, y);
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