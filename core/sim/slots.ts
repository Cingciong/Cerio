import { RULES } from "../config/config.ts";
import type { ItemType, SlotItem } from "../entities/powerup.ts";
import type { GameState } from "./state.ts";

/** Same key scheme as GameState.multiCoins. */
export function blockKey(area: string, width: number, tx: number, ty: number): string {
  return `${area}:${ty * width + tx}`;
}

/**
 * What the `?` block at (tx, ty) gives, or undefined when the level did not plan it
 * (hand-made level) and the caller falls back to questionItem().
 * Like in SMB the mushroom is only a mushroom for small Mario: a big one gets RULES.mushroomUpgrade (the flower).
 * No randomness here: the same level always gives the same items.
 */
export function plannedItem(state: GameState, tx: number, ty: number): SlotItem | undefined {
  const item = state.blockItems[blockKey(state.area, state.map.width, tx, ty)];
  if (item === "mushroom" && state.player.powerState !== "small") return RULES.mushroomUpgrade as ItemType;
  return item;
}
