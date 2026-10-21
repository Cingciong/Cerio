/** Target level width in tiles, with tolerance as a fraction (0.1 = ±10%). */
export class LengthPolicy {
  readonly min: number;
  readonly max: number;

  constructor(target: number, tolerance = 0.1) {
    this.min = Math.round(target * (1 - tolerance));
    this.max = Math.round(target * (1 + tolerance));
  }

  fits(width: number, reserve: number): boolean {
    return width + reserve <= this.max;
  }

  done(width: number, reserve: number): boolean {
    return width + reserve >= this.min;
  }
}
