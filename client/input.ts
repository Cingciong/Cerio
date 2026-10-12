import { Button, type ButtonName, type Buttons } from "../core/index.ts";

// Keyboard -> button names (shared/game.json "buttons").
const KEYS: Record<string, ButtonName> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  KeyZ: "jump",
  Space: "jump",
  ArrowUp: "jump",
  KeyX: "run",
  ShiftLeft: "run",
  ArrowDown: "down",
  KeyS: "down",
  KeyC: "attack",
};

const held = new Set<string>();
let restart = false;

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") restart = true;
  if (e.code in KEYS) e.preventDefault();
  held.add(e.code);
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => held.clear());

export function readButtons(): Buttons {
  let b = 0;
  for (const code of held) if (KEYS[code]) b |= Button[KEYS[code]];
  return b;
}

export function takeRestart(): boolean {
  const r = restart;
  restart = false;
  return r;
}
