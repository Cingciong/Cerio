// Mario movement. Physics values: shared/game.json "player" (subpixels and frames).

import { Body, type Collision } from "./body.ts";
import { Button, has, type Buttons } from "../config/buttons.ts";
import { PLAYER } from "../config/config.ts";
import { SUB } from "../config/constants.ts";
import { isSolid, toTile, type TileMap } from "../world/tiles.ts";

export type PowerState = 'small' | 'big' | 'fire' | 'hammer_suit' | 'star' | 'leaf' | 'tanooki' | 'frog';

export class Player extends Body {
  buttons: Buttons = 0; // pressed this frame
  prevButtons: Buttons = 0;
  alive = true;
  facing: -1 | 1 = 1;

  powerState: PowerState = 'small';
  invulnerableTimer = 0;
  starTimer = 0; // frames of star power left
  powerBeforeStar: PowerState = 'small'; // form restored when the star runs out
  wantsShoot = false;  
  crouching = false;

  constructor(x: number, y: number) {
    super(x, y, PLAYER.w, PLAYER.h);
  }

  update(buttons: Buttons, map: TileMap): Collision {
    this.prevButtons = this.buttons;
    this.buttons = buttons;

    this.updateCrouch(buttons, map);

    const attackPressed = has(buttons, Button.attack) && !has(this.prevButtons, Button.attack); 
    this.wantsShoot = attackPressed && !this.crouching && ['fire', 'hammer_suit', 'leaf', 'tanooki'].includes(this.form);

    if (this.invulnerableTimer > 0){
      this.invulnerableTimer--;
    }

    if (this.starTimer > 0) {
      this.starTimer--;
      if (this.starTimer === 0 && this.powerState === 'star') {
        this.powerState = this.powerBeforeStar; // star is over: enemies hurt again
        this.invulnerableTimer = 0;
      }
    }

    const targetHeight = (this.form === 'small' || this.crouching) ? PLAYER.h : 32;

    if(this.h !== targetHeight){
      const diff = targetHeight - this.h;
      this.h = targetHeight;
      this.y -= diff * 16;
    }

    this.horizontal(buttons);
    this.jump(buttons);

    const rising = this.vy < 0 && has(buttons, Button.jump);
    let currentGravity = rising ? PLAYER.gravityHold : PLAYER.gravity;
    let currentMaxFall = PLAYER.maxFall;

    if((this.form === 'leaf' || this.form === 'tanooki') && this.vy > 0 && has(buttons, Button.jump)){
      currentMaxFall = 16;
    }

    this.vy = Math.min(this.vy + currentGravity, currentMaxFall);

    return this.move(map);
  }

  
  get fireproof(): boolean {
    return this.crouching && this.form === 'hammer_suit';
  }

  /** The form Mario has under a star: the one he had before it. */
  get form(): PowerState {
    return this.powerState === 'star' ? this.powerBeforeStar : this.powerState;
  }

  startStar(duration: number): void {
    if (this.powerState !== 'star') this.powerBeforeStar = this.powerState;
    this.powerState = 'star';
    this.starTimer = duration;
    this.invulnerableTimer = duration;
  }

  takeDamage(): void{
    if(this.invulnerableTimer > 0) return;
    if(this.powerState === 'star') return;
    if(this.powerState === 'small'){
      this.alive = false;
    }else {
      this.powerState = (this.powerState === 'big') ? 'small' : 'big';
      this.invulnerableTimer = PLAYER.invulnerableFrames;
    }
  }

  
  private updateCrouch(buttons: Buttons, map: TileMap): void {
    const canCrouch = this.form === 'hammer_suit';
    const wantsDown = has(buttons, Button.down);

    if (this.crouching) {
      const keepDucking = canCrouch && wantsDown && this.onGround;
      if (!keepDucking && this.hasHeadroom(map)) this.crouching = false;
    } else if (canCrouch && wantsDown && this.onGround) {
      this.crouching = true;
    }
  }

  
  private hasHeadroom(map: TileMap): boolean {
    const standingTop = this.bottom - 32 * SUB;
    for (let tx = toTile(this.x); tx <= toTile(this.right - 1); tx++) {
      for (let ty = toTile(standingTop); ty <= toTile(this.y - 1); ty++) {
        if (isSolid(map, tx, ty)) return false;
      }
    }
    return true;
  }

  private horizontal(buttons: Buttons): void {
    // Ducked on the ground: no walking and no turning, Mario just slows down.
    const dir = this.crouching && this.onGround
      ? 0
      : (has(buttons, Button.right) ? 1 : 0) - (has(buttons, Button.left) ? 1 : 0);
    if (dir !== 0) this.facing = dir < 0 ? -1 : 1;
    const max = has(buttons, Button.run) ? PLAYER.runMax : PLAYER.walkMax;

    if (dir === 0) {
      this.vx = approach(this.vx, 0, PLAYER.friction);
    } else if (this.vx * dir < 0) {
      this.vx += dir * PLAYER.skid;
    } else if (Math.abs(this.vx) < max) {
      this.vx = approach(this.vx, dir * max, PLAYER.accel);
    } else {
      this.vx = approach(this.vx, dir * max, PLAYER.friction); // released Run: slow down to walk
    }
  }

  private jump(buttons: Buttons): void {
    const pressed = has(buttons, Button.jump) && !has(this.prevButtons, Button.jump);
    if (pressed && this.onGround) {
      const frogJump = (PLAYER as any).jumpFrog || 96
      this.vy = -(this.form === 'frog' ? frogJump : Math.abs(this.vx) >= PLAYER.runJumpSpeed ? PLAYER.jumpRunning : PLAYER.jump);
      this.onGround = false;
      this.hit.ground = false;
    }
  }
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}
