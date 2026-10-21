/** Target level width in tiles, with tolerance as a fraction (0.1 = ±10%). */
export class LengthPolicy {
  readonly target: number;
  readonly min: number;
  readonly max: number;

  constructor(target: number, tolerance = 0.1) {
    this.target = target;
    this.min = Math.round(target * (1 - tolerance));
    this.max = Math.round(target * (1 + tolerance));
  }

  fits(width: number, reserve: number): boolean {
    return width + reserve <= this.max;
  }

  within(width: number): boolean {
    return width >= this.min && width <= this.max;
  }

  done(width: number, reserve: number): boolean {
    return width + reserve >= this.min;
  }
}
