// Mario movement. Physics values: shared/game.json "player" (subpixels and frames).

import { Body } from "./body.ts";
import { Button, has, type Buttons } from "../config/buttons.ts";
import { PLAYER } from "../config/config.ts";
import type { TileMap } from "../world/tiles.ts";

export class Player extends Body {
  buttons: Buttons = 0; // pressed this frame
  prevButtons: Buttons = 0;
  alive = true;
  facing: -1 | 1 = 1;

  constructor(x: number, y: number) {
    super(x, y, PLAYER.w, PLAYER.h);
  }

  update(buttons: Buttons, map: TileMap): void {
    this.prevButtons = this.buttons;
    this.buttons = buttons;

    this.horizontal(buttons);
    this.jump(buttons);

    const rising = this.vy < 0 && has(buttons, Button.jump);
    this.vy = Math.min(this.vy + (rising ? PLAYER.gravityHold : PLAYER.gravity), PLAYER.maxFall);

    this.move(map);
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
