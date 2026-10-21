// One frame of the game. Mutates the state.

import type { Buttons } from "../config/buttons.ts";
import { SUB, TILE_SUB } from "../config/constants.ts";
import { PLAYER, RULES } from "../config/config.ts";
import type { GameState } from "./state.ts";
import { HammerBro } from "../entities/enemy.ts";
import { stepPipe, tryEnterPipe } from "./pipes.ts";
import { isSolid, toTile } from "../world/tiles.ts";

/** Buttons for enemies by id. Missing id -> the enemy's own decide(). */
export type EnemyButtons = Record<number, Buttons>;

export function step(state: GameState, buttons: Buttons, enemyButtons: EnemyButtons = {}): void {
  if (state.status !== "playing") return;
  state.frame++;
  if (state.pipe) return stepPipe(state);

  const { player, map, platforms } = state;

  // 1. Move platforms and carry player if standing on one
  for (const platform of platforms) {
    const oldX = platform.x;
    const oldY = platform.y;
    platform.update();

    if (state.standingPlatform === platform) {
      const dx = platform.x - oldX;
      const dy = platform.y - oldY;

      // Przemieszczenie gracza w osi X z zabezpieczeniem przed wejściem w ścianę
      player.x += dx;
      if (dx !== 0) {
        const tx = dx > 0 ? toTile(player.right - 1) : toTile(player.x);
        let hitWall = false;
        for (let ty = toTile(player.y); ty <= toTile(player.bottom - 1); ty++) {
          if (isSolid(map, tx, ty)) {
            hitWall = true;
            break;
          }
        }
        if (hitWall) {
          player.x = dx > 0 ? tx * TILE_SUB - player.w * SUB : (tx + 1) * TILE_SUB;
        }
      }

      // Przemieszczenie gracza w osi Y z zabezpieczeniem przed wejściem w sufit
      player.y += dy;
      for (let tx = toTile(player.x); tx <= toTile(player.right - 1); tx++) {
        if (isSolid(map, tx, toTile(player.y))) {
          player.y = (toTile(player.y) + 1) * TILE_SUB;
          if (player.bottom > platform.y) {
            player.alive = false; // zmiażdżenie między platformą a sufitem
          }
        }
      }
    }
  }

  const prevBottom = player.bottom;

  // 2. Player movement (input, gravity, tile collisions)
  player.update(buttons, map);
  if (tryEnterPipe(state, buttons)) return;

  // 3. Platform collision detection (one-way semi-solid landing)
  state.standingPlatform = null;
  for (const platform of platforms) {
    const overlapsX = player.right > platform.x && player.x < platform.right;
    if (!overlapsX) continue;

    const tolerance = Math.max(8 * SUB, player.vy + Math.abs(platform.vy) + 2 * SUB);
    const wasAbove = prevBottom <= platform.y + tolerance;
    const isAtOrBelowTop = player.bottom >= platform.y;
    const notBelowBottom = player.bottom <= platform.bottom + 8 * SUB;

    if (player.vy >= 0 && wasAbove && isAtOrBelowTop && notBelowBottom) {
      player.y = platform.y - player.h * SUB;
      player.vy = 0;
      player.onGround = true;
      state.standingPlatform = platform;
      break;
    }
  }

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
  if (state.area === "overworld" && player.right >= map.width * TILE_SUB) state.status = "won"; // touched the right edge of the map (until there is a flagpole)
}
