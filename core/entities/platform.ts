import { Body } from "./body.ts";
import { SUB } from "../config/constants.ts";

export type LiftType = "horizontal" | "vertical";

export class Platform extends Body {
  readonly id: number;
  readonly liftType: LiftType;
  readonly range: number; // zasięg ruchu w subpixelach
  readonly startX: number;
  readonly startY: number;
  dir: 1 | -1;
  speed: number; // subpixele na klatkę

  constructor(
    id: number,
    x: number, // subpixele
    y: number, // subpixele
    w: number, // pixele
    h: number, // pixele
    type: LiftType,
    range: number, // pixele
    speed: number = 1, // pixele na klatkę (domyślnie 1 px/klatkę = 16 subpixeli)
    dir: 1 | -1 = 1
  ) {
    super(x, y, w, h);
    this.id = id;
    this.liftType = type;
    this.range = Math.round(range * SUB);
    this.startX = this.x;
    this.startY = this.y;
    this.speed = Math.round(speed * SUB);
    this.dir = dir;
  }

  update(): void {
    if (this.liftType === "horizontal") {
      this.vx = this.dir * this.speed;
      this.vy = 0;
      this.x += this.vx;

      // Zmiana kierunku na granicach zakresu
      if (this.dir > 0 && this.x >= this.startX + this.range) {
        this.x = this.startX + this.range;
        this.dir = -1;
      } else if (this.dir < 0 && this.x <= this.startX - this.range) {
        this.x = this.startX - this.range;
        this.dir = 1;
      }
    } else {
      this.vx = 0;
      this.vy = this.dir * this.speed;
      this.y += this.vy;

      // Ruch góra/dół (dir=1: w dół, dir=-1: w górę)
      if (this.dir > 0 && this.y >= this.startY + this.range) {
        this.y = this.startY + this.range;
        this.dir = -1;
      } else if (this.dir < 0 && this.y <= this.startY - this.range) {
        this.y = this.startY - this.range;
        this.dir = 1;
      }
    }
  }
}
