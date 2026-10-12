// Enemies are driven by Buttons, like the player.
// decide() is the controller: now a simple rule, later a small neural network
// (the server can return buttons per enemy id, see frame.ts).
// Size and physics per type: shared/game.json "enemies".

import { Body } from "./body.ts";
import { Button, has, type Buttons } from "./buttons.ts";
import { ENEMIES, type EnemyConfig } from "./config.ts";
import { TILE_SUB } from "./constants.ts";
import type { TileMap } from "./tiles.ts";

export class Enemy extends Body {
  readonly id: number;
  readonly type: string;
  readonly cfg: EnemyConfig;
  alive = true;
  dir = -1; // -1 left, 1 right
  buttons: Buttons = 0;

  constructor(id: number, type: string, x: number, y: number) {
    const cfg = ENEMIES[type];
    super(x, y, cfg.w, cfg.h);
    this.cfg = cfg;
    this.id = id;
    this.type = type;
  }

  /** Default controller: walk, turn around at walls. */
  decide(): Buttons {
    return this.dir < 0 ? Button.left : Button.right;
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
