// Mario movement. Physics values: shared/game.json "player" (subpixels and frames).

import { Body, type Collision } from "./body.ts";
import { Button, has, type Buttons } from "../config/buttons.ts";
import { PLAYER } from "../config/config.ts";
import type { TileMap } from "../world/tiles.ts";

export type PowerState = 'small' | 'big' | 'fire' | 'hammer_suit' | 'star';

export class Player extends Body {
  buttons: Buttons = 0; // pressed this frame
  prevButtons: Buttons = 0;
  alive = true;
  facing: -1 | 1 = 1;

  powerState: PowerState = 'small';
  invulnerableTimer = 0;
  wantsShoot = false; 

  constructor(x: number, y: number) {
    super(x, y, PLAYER.w, PLAYER.h);
  }

  update(buttons: Buttons, map: TileMap): Collision {
    this.prevButtons = this.buttons;
    this.buttons = buttons;

    const attackPressed = has(buttons, Button.attack) && !has(this.prevButtons, Button.attack); 
    this.wantsShoot = attackPressed && (this.powerState === 'fire' || this.powerState === 'hammer_suit');

    if (this.invulnerableTimer > 0){
      this.invulnerableTimer--;
    }

    const targetHeight = (this.powerState === 'small') ? PLAYER.h : 32;

    if(this.h !== targetHeight){
      const diff = targetHeight - this.h;
      this.h = targetHeight;
      this.y -= diff * 16;
    }

    this.horizontal(buttons);
    this.jump(buttons);

    const rising = this.vy < 0 && has(buttons, Button.jump);
    this.vy = Math.min(this.vy + (rising ? PLAYER.gravityHold : PLAYER.gravity), PLAYER.maxFall);

    return this.move(map);
  }

  takeDamage(): void{
    if(this.invulnerableTimer > 0) return;
    if(this.powerState === 'star'){
      return;
    }
    if(this.powerState === 'small'){
      this.alive = false;
    }else if(this.powerState === 'fire' || this.powerState === 'hammer_suit'){
      this.powerState = 'big';
      this.invulnerableTimer = PLAYER.invulnerableFrames;
    }else if(this.powerState === 'big'){
      this.powerState = 'small';
      this.invulnerableTimer = PLAYER.invulnerableFrames;
    }
  }

  private horizontal(buttons: Buttons): void {
    const dir = (has(buttons, Button.right) ? 1 : 0) - (has(buttons, Button.left) ? 1 : 0);
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
      this.vy = -(Math.abs(this.vx) >= PLAYER.runJumpSpeed ? PLAYER.jumpRunning : PLAYER.jump);
      this.onGround = false;
    }
  }
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}
