// One frame of the game. Mutates the state.

import type { Buttons } from "../config/buttons.ts";
import { SUB, TILE_SUB } from "../config/constants.ts";
import { PLAYER, PROJECTILES, RULES } from "../config/config.ts";
import type { GameState } from "./state.ts";
import { HammerBro } from "../entities/enemy.ts";
import { Tile, tileAt, toTile } from "../world/tiles.ts"
import { Item, type ItemType } from "../entities/powerup.ts"
import { Projectile } from "../entities/projectile.ts"
import { hitBlockAbove, stepBlocks } from "./blocks.ts";
import { stepPipe, tryEnterPipe } from "./pipes.ts";
import { updateRedCoins } from "./redcoins.ts";
import { collectCoins } from "./coins.ts";

export type EnemyButtons = Record<number, Buttons>;

export function step(state: GameState, buttons: Buttons, enemyButtons: EnemyButtons = {}): void {
  if (state.status !== "playing") return;
  state.frame++;
  state.events = [];
  if (state.pipe) return stepPipe(state);
  stepBlocks(state);

  const { player, map } = state;
  const prevBottom = player.bottom;
  const hit = player.update(buttons, map);

  if (tryEnterPipe(state, buttons)) return;
  collectCoins(state);
  updateRedCoins(state);
  if(hit.ceiling){
    const txCenter = toTile(player.x + (player.w/2)*SUB);
    const tyAbove = toTile(player.y)-1;
    const tileId = tileAt(map, txCenter, tyAbove);

    if(tileId === Tile.question){
      map.tiles[tyAbove*map.width+txCenter] = Tile.used;
      const newItemId = state.items.length;
      const itemX = txCenter*16*SUB;
      const itemY = tyAbove*16*SUB;
      
      const kind = RULES.questionItem === 'auto' ? (player.powerState === 'hammer_suit') : RULES.questionItem as ItemType;
      state.items.push(new Item(newItemId, kind, itemX, itemY));
    }
    hitBlockAbove(state);
  }

  for(const item of state.items){
    item.update(map);
    if(item.alive && !item.spawning && player.overlaps(item)){
      item.alive = false;
      if(item.type === 'mushroom'){
        if(player.powerState === 'small'){
          player.powerState = 'big';
          player.y -= 16*SUB;
        }
      }else if(item.type === 'flower'){
        player.powerState = 'fire';
      }else if(item.type === 'hammer_suit'){
        player.powerState = 'hammer_suit';
      }else if(item.type === 'star'){
        player.powerState = 'star';
        player.invulnerableTimer = 600;
      }
    }
  }

  for (const enemy of state.enemies) {
    enemy.update(enemyButtons[enemy.id] ?? enemy.decide(map, player), map, player);
  }

  if (player.wantsShoot) {
    const type = player.powerState === 'hammer_suit' ? 'hammer' : 'fireball';
    const cfg = PROJECTILES[type];
    if (state.projectiles.filter((p) => p.alive && p.type === type).length < cfg.maxAlive) {
      const x = player.facing > 0 ? player.right : player.x - cfg.w * SUB;
      state.projectiles.push(new Projectile(type, x, player.y + 8 * SUB, player.facing));
    }
  }
  for (const p of state.projectiles) {
    p.update(map);
    if (!p.alive) continue;
    const cfg = PROJECTILES[p.type];
    for (const enemy of state.enemies) {
      if (!enemy.alive || !p.overlaps(enemy)) continue;
      if (!cfg.immune.includes(enemy.type)) enemy.alive = false;
      if (!cfg.pierce) {
        p.alive = false;
        break;
      }
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.alive);

  
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.actionState !== 'shell_sliding') continue;

    for(const other of state.enemies){
      if(enemy !== other && other.alive && enemy.overlaps(other)){
        other.alive = false;
      }
    }
  }
  

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
          if(player.powerState === 'star'){
            enemy.alive = false;
          }else{
            player.takeDamage();
          }
          hammer.alive = false;
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
          if(player.powerState === 'star'){
            enemy.alive = false;
          }else{
            player.takeDamage();
          }
        }
      }
    }
  }

  if (player.y > map.height * TILE_SUB) player.alive = false; 
  if (!player.alive) state.status = "dead";
  if (state.area === "overworld" && player.right >= map.width * TILE_SUB) state.status = "won"; // touched the right edge of the map (until there is a flagpole)
}
