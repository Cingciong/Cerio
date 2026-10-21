// Buttons are a bitmask. The same format is used by the keyboard, the player bot and enemies.
// The list of buttons is in shared/game.json.

import { Button, type ButtonName } from "./config.ts";

export { Button, type ButtonName };

export type Buttons = number;

export const NONE: Buttons = 0;

export function has(buttons: Buttons, button: number): boolean {
  return (buttons & button) !== 0;
}

/** press("right", "jump") -> bitmask */
export function press(...names: ButtonName[]): Buttons {
  return names.reduce((b, n) => b | Button[n], 0);
}
