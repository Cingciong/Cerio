// Hitboxes only, no sprites. Reads the state, never changes it.

import { SCREEN_H, SCREEN_W, SUB, TILE, Tile, TILES, ENEMIES, type Body, type GameState, HammerBro } from "../core/index.ts";

const COLORS = {
  sky: "#5C94FC",
  block: "#8a5a2b",
  blockEdge: "#c9894b",
  player: "#e33",
  enemy: "#d9a400",
  hammer: "#fccbcb",
  text: "#fff",
};

// Zbudujmy niezawodną mapę ID -> Kolor jako słownik, zamiast jako tablicę, która może tracić indeksy
const TILE_COLORS: Record<number, string> = {};
for (const t of Object.values(TILES)) {
  TILE_COLORS[(t as any).id] = (t as any).color || COLORS.block;
}

const ENEMY_COLORS: Record<string, string> = {};
for (const [type, cfg] of Object.entries(ENEMIES)) {
  ENEMY_COLORS[type] = (cfg as any).color || COLORS.enemy;
}

export interface Camera {
  x: number; // px, top-left of the screen in the world
  y: number;
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera, info: string): void {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  
  for (const e of state.enemies) if (e.alive && e.type === "piranha") box(ctx, e, cam, ENEMY_COLORS[e.type] || COLORS.enemy);

  // tiles on screen
  const { map } = state;
  const first = Math.floor(cam.x / TILE);
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = first; tx <= first + SCREEN_W / TILE; tx++) {
      if (tx >= map.width) continue; 
      const tileId = map.tiles[ty * map.width + tx];
      if (tileId === Tile.air || tileId === undefined) continue;
      
      const x = tx * TILE - cam.x;
      const y = ty * TILE - cam.y;
      
      // Pewne odczytywanie koloru ze słownika.
      ctx.fillStyle = TILE_COLORS[tileId] || COLORS.block;
      
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = COLORS.blockEdge;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }

  for (const e of state.enemies) {
    if (!e.alive || e.type === "piranha") continue;
      
      box(ctx, e, cam, ENEMY_COLORS[e.type] || COLORS.enemy);

      if (e instanceof HammerBro) {
        for (const hammer of e.hammers) {
          if (!hammer.alive) continue;
          ctx.fillStyle = COLORS.hammer;
          ctx.fillRect(Math.round(hammer.x / SUB - cam.x), Math.round(hammer.y / SUB - cam.y), 8, 8);
        }
      }
    }
  
  box(ctx, state.player, cam, COLORS.player);

  ctx.fillStyle = COLORS.text;
  ctx.font = "8px monospace";
  ctx.fillText(info, 4, 10);
  if (state.status === "dead") ctx.fillText("DEAD - R to restart", 80, 120);
  if (state.status === "won") ctx.fillText("LEVEL DONE - R to restart", 64, 120);
}

function box(ctx: CanvasRenderingContext2D, b: Body, cam: Camera, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(b.x / SUB - cam.x), Math.round(b.y / SUB - cam.y), b.w, b.h);
}

/**
 * X: player at 40% of the screen width, clamped to the map width.
 * Y: bottom of the map stays at the bottom of the screen; the camera only goes up
 *    when the player goes above the map (open top).
 */
export function camera(state: GameState): Camera {
  const { player, map } = state;
  const maxX = map.width * TILE - SCREEN_W;
  const maxY = map.height * TILE - SCREEN_H;
  const x = Math.max(0, Math.min(Math.round(player.x / SUB - SCREEN_W * 0.4), maxX));
  const y = Math.min(Math.round(player.y / SUB - SCREEN_H * 0.3), maxY);
  return { x, y };
}