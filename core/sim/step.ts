// One frame of the game. Mutates the state.

import type { Buttons } from "../config/buttons.ts";
import { SUB, TILE_SUB } from "../config/constants.ts";
import { PLAYER, RULES } from "../config/config.ts";
import type { GameState } from "./state.ts";
import { HammerBro } from "../entities/enemy.ts";

/** Buttons for enemies by id. Missing id -> the enemy's own decide(). */
export type EnemyButtons = Record<number, Buttons>;

export function step(state: GameState, buttons: Buttons, enemyButtons: EnemyButtons = {}): void {
  if (state.status !== "playing") return;
  state.frame++;

  const { player, map } = state;
  const prevBottom = player.bottom;
  player.update(buttons, map);

  for (const enemy of state.enemies) {
    enemy.update(enemyButtons[enemy.id] ?? enemy.decide(map, player), map, player);
  }

  // Player vs enemies: landing on top kills the enemy, anything else kills the player.
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.actionState !== 'shell_sliding') continue;

    for(const other of state.enemies){
      if(enemy !== other && other.alive && enemy.overlaps(other)){
        other.alive = false;
      }
    }
  }
  
  // Hammer projectiles vs player.
  if (player.alive) {
    for (const enemy of state.enemies) {
      if (!(enemy instanceof HammerBro) || !enemy.alive) continue;

      for (const hammer of enemy.hammers) {
        if (!hammer.alive) continue;

        const overlaps =
          hammer.x < player.x + player.w * SUB &&
          hammer.x + HammerBro.HAMMER_WIDTH > player.x &&
          hammer.y < player.y + player.h * SUB &&
          hammer.y + HammerBro.HAMMER_HEIGHT > player.y;

        if (overlaps) {
          hammer.alive = false;
          player.alive = false;
          break;
        }
      }

      if (!player.alive) break;
    }
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive || !player.overlaps(enemy)) continue;
    const fromAbove = player.vy > 0 && prevBottom <= enemy.y + RULES.stompTolerancePx * SUB; // feet were in the top part of the enemy
    if (fromAbove && enemy.stompable) {
      const shouldBounce = enemy.onStomp(player.x);
      if (shouldBounce){
        player.vy = -PLAYER.stompBounce;
      }
    } else {
      if(enemy.actionState === 'shell_idle'){
        enemy.onStomp(player.x);
      }else{
        const isShellMovingAway = enemy.actionState === 'shell_sliding' && ((player.x <= enemy.x && enemy.dir === 1) || (player.x >= enemy.x && enemy.dir === -1));
        if(!isShellMovingAway){
          player.alive = false;
        }
      }
    }
  }

  if (player.y > map.height * TILE_SUB) player.alive = false; // fell into a pit
  if (!player.alive) state.status = "dead";
  if (player.right >= map.width * TILE_SUB) state.status = "won"; // touched the right edge of the map (until there is a flagpole)
}
