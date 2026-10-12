// One frame of the game. Mutates the state.

import type { Buttons } from "./buttons.ts";
import { SUB, TILE_SUB } from "./constants.ts";
import { PLAYER, RULES } from "./config.ts";
import type { GameState } from "./state.ts";

/** Buttons for enemies by id. Missing id -> the enemy's own decide(). */
export type EnemyButtons = Record<number, Buttons>;

export function step(state: GameState, buttons: Buttons, enemyButtons: EnemyButtons = {}): void {
  if (state.status !== "playing") return;
  state.frame++;

  const { player, map } = state;
  const prevBottom = player.bottom;
  player.update(buttons, map);

  for (const enemy of state.enemies) {
    enemy.update(enemyButtons[enemy.id] ?? enemy.decide(), map);
  }

  // Player vs enemies: landing on top kills the enemy, anything else kills the player.
  for (const enemy of state.enemies) {
    if (!enemy.alive || !player.overlaps(enemy)) continue;
    const fromAbove = player.vy > 0 && prevBottom <= enemy.y + RULES.stompTolerancePx * SUB; // feet were in the top part of the enemy
    if (fromAbove) {
      enemy.alive = false;
      player.vy = -PLAYER.stompBounce;
    } else {
      player.alive = false;
    }
  }

  if (player.y > map.height * TILE_SUB) player.alive = false; // fell into a pit
  if (!player.alive) state.status = "dead";
  if (player.right >= map.width * TILE_SUB) state.status = "won"; // touched the right edge of the map (until there is a flagpole)
}
