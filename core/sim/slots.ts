import { RULES } from "../config/config.ts";
import type { ItemType, SlotItem } from "../entities/powerup.ts";
import type { GameState } from "./state.ts";

export function blockKey(area: string, width: number, tx: number, ty: number): string {
  return `${area}:${ty * width + tx}`;
}


export function plannedItem(state: GameState, tx: number, ty: number): SlotItem | undefined {
  const item = state.blockItems[blockKey(state.area, state.map.width, tx, ty)];
  if (item === "mushroom" && state.player.powerState !== "small") return RULES.mushroomUpgrade as ItemType;
  return item;
}
