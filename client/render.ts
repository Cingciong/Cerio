
import { BLOCKS, bumpOffset, SCREEN_H, SCREEN_W, SUB, TILE, Tile, TILES, ENEMIES, type Body, type Enemy, type GameState, type SegmentSpan, HammerBro, KoopaEnemy, PiranhaPlant } from "../core/index.ts";
import {
  COIN_FRAMES,
  GOOMBA_WALK,
  HAMMER_BRO_FRAMES,
  HAMMER_PROJECTILE,
  KOOPA_SHELL,
  KOOPA_WALK,
  MARIO_IDLE,
  MARIO_JUMP,
  MARIO_WALK,
  PIRANHA_PLANT_FRAMES,
  TILE_SPRITES,
  type SpriteFrame,
} from "./spriteFrames.ts";

function loadSpriteSheet(path: string): HTMLImageElement {
  const image = new Image();
  image.src = new URL(path, import.meta.url).href;
  return image;
}

const marioSpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/Mario.png");
const enemySpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/Enemies.png");
const itemSpriteSheet = loadSpriteSheet("./sprites/Mario1/Misc/Items.png");
const overworldSpriteSheet = loadSpriteSheet("./sprites/Mario1/Tilesets/OverWorld.png");

const COLORS = {
  sky: "#5C94FC",
  block: "#8a5a2b",
  blockEdge: "#ca9662",
  player: "#e33",
  enemy: "#d9a400",
  hammer: "#fccbcb",
  segment: "rgba(255,255,255,0.5)",
  text: "#fff",
};

const TILE_COLORS: Record<number, string> = {};
for (const t of Object.values(TILES)) {
  TILE_COLORS[t.id] = (t as any).color || COLORS.block;
}

const ENEMY_COLORS: Record<string, string> = {};
for (const [type, cfg] of Object.entries(ENEMIES)) {
  ENEMY_COLORS[type] = (cfg as any).color || COLORS.enemy;
}

const ITEM_COLORS: Record<string, string> = {
  mushroom: "#FF4500",
  flower: "#FF8C00",
  star: "#FFD700",
  leaf: "#8B4513",
  stopwatch: "#00CED1",
  frog: "#32CD32",
  hammer_suit: "#696969",
  tanooki: "#D2B48C"
};

export interface Camera {
  x: number; 
  y: number;
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera, info: string): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  if (state.pipe) drawPlayer(ctx, state, cam); 

  const { map } = state;
  const first = Math.floor(cam.x / TILE);
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = first; tx <= first + SCREEN_W / TILE; tx++) {
      if (tx >= map.width) continue; 
      const tileId = map.tiles[ty * map.width + tx];
      if (tileId === Tile.air || tileId === undefined) continue;
      const x = tx * TILE - cam.x;
      const y = ty * TILE - cam.y - bumpOffset(state, tx, ty);
      
      drawTile(ctx, tileId, x, y, state.frame, map, tx, ty);
    }
  }

  for (const e of state.enemies) {
    if (!e.alive) continue;

    if (e instanceof PiranhaPlant) {
      if (e.phase === "hidden") continue;
      if (isSpriteReady(enemySpriteSheet)) {
        const frame = PIRANHA_PLANT_FRAMES[Math.floor(state.frame / 8) % PIRANHA_PLANT_FRAMES.length];
        drawSpriteFrame(ctx, enemySpriteSheet, e, cam, frame, false);
      } else {
        box(ctx, e, cam, ENEMY_COLORS[e.type] || COLORS.enemy);
      }
      continue;
    }

    drawEnemy(ctx, e, cam, state.frame);

    if (e instanceof HammerBro) {
      for (const hammer of e.hammers) {
        if (!hammer.alive) continue;

        const x = Math.round(hammer.x / SUB - cam.x);
        const y = Math.round(hammer.y / SUB - cam.y);
        if (isSpriteReady(enemySpriteSheet)) {
          ctx.drawImage(
            enemySpriteSheet,
            HAMMER_PROJECTILE.x,
            HAMMER_PROJECTILE.y,
            HAMMER_PROJECTILE.width,
            HAMMER_PROJECTILE.height,
            x,
            y,
            HammerBro.HAMMER_WIDTH / SUB,
            HammerBro.HAMMER_HEIGHT / SUB,
          );
        } else {
          ctx.fillStyle = COLORS.hammer;
          ctx.fillRect(
            x,
            y,
            HammerBro.HAMMER_WIDTH / SUB,
            HammerBro.HAMMER_HEIGHT / SUB,
          );
        }
      }
    }
  }

  drawPipesInFront(ctx, map, cam);

  ctx.fillStyle = TILE_COLORS[Tile.brick];
  for (const d of state.debris) ctx.fillRect(Math.round(d.x / SUB - cam.x), Math.round(d.y / SUB - cam.y), BLOCKS.debrisPx, BLOCKS.debrisPx);
  
  if(state.items){
    for(const item of state.items){
      if(!item.alive) continue;

      if(item.type === 'star' && Math.floor(state.frame/4)%2===0){
        ctx.fillStyle = "#FFFFFF";
      }else{
        ctx.fillStyle = ITEM_COLORS[item.type] || "#FFFFFF";
      }
      ctx.fillRect(Math.round(item.x / SUB -cam.x), Math.round(item.y/SUB - cam.y), item.w, item.h);
    }
  }

  if (!state.pipe) {
    const isBlinking = state.player.invulnerableTimer > 0 && Math.floor(state.frame / 4) % 2 === 0;
    
    if (!isBlinking) {
      drawPlayer(ctx, state, cam); 
    }
  }
  const seg = segmentDebug(ctx, state, cam);

  ctx.fillStyle = COLORS.text;
  ctx.font = "8px monospace";
  ctx.fillText(info, 4, 10);
  if (seg) ctx.fillText(seg, 4, 20);
  ctx.fillText(`cave ${state.level.areas.cave ? "yes" : "no"}  area ${state.area}`, 4, 30);
  if (state.status === "dead") ctx.fillText("DEAD - R to restart", 80, 120);
  if (state.status === "won") ctx.fillText("LEVEL DONE - R to restart", 64, 120);
}

/** Dashed line at each segment start; returns "seg i/n name" for the player's segment. */
function segmentDebug(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera): string {
  const segs = state.level.areas[state.area].segments;
  ctx.strokeStyle = COLORS.segment;
  ctx.setLineDash([4, 4]);
  for (const s of segs) {
    const x = s.x * TILE - cam.x + 0.5;
    if (x < 0 || x > SCREEN_W) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SCREEN_H);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const seg = currentSegment(state);
  return seg ? `seg ${segs.indexOf(seg) + 1}/${segs.length} ${seg.name}` : "";
}

/** Segment the player's centre is in. */
export function currentSegment(state: GameState): SegmentSpan | undefined {
  const px = (state.player.x + (state.player.w * SUB) / 2) / (TILE * SUB);
  return state.level.areas[state.area].segments.find((s) => px >= s.x && px < s.x + s.w);
}

function box(ctx: CanvasRenderingContext2D, b: Body, cam: Camera, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(b.x / SUB - cam.x), Math.round(b.y / SUB - cam.y), b.w, b.h);
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tileId: number,
  x: number,
  y: number,
  frameNumber: number,
  map: GameState["map"],
  tx: number,
  ty: number,
): void {
  if (tileId === Tile.coin && isSpriteReady(itemSpriteSheet)) {
    const frame = COIN_FRAMES[Math.floor(frameNumber / 8) % COIN_FRAMES.length];
    ctx.drawImage(itemSpriteSheet, frame.x, frame.y, frame.width, frame.height, x, y, TILE, TILE);
    return;
  }

  const frame = pipeSprite(map, tx, ty, tileId) ?? TILE_SPRITES[tileId];
  if (frame && isSpriteReady(overworldSpriteSheet)) {
    ctx.drawImage(overworldSpriteSheet, frame.x, frame.y, frame.width, frame.height, x, y, TILE, TILE);
    return;
  }

  ctx.fillStyle = TILE_COLORS[tileId] || COLORS.block;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = COLORS.blockEdge;
  ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
}

function pipeSprite(map: GameState["map"], tx: number, ty: number, tileId: number): SpriteFrame | undefined {
  if (!isPipeTile(tileId)) return undefined;

  const rightHalf = isPipeAt(map, tx - 1, ty);
  const hasPipeAbove = isPipeAt(map, tx, ty - 1);

  if (hasPipeAbove) {
    return rightHalf ? TILE_SPRITES[Tile.pipe_right_body] : TILE_SPRITES[Tile.pipe_left_body];
  }
  return rightHalf ? TILE_SPRITES[Tile.pipe_right_top] : TILE_SPRITES[Tile.pipe_left_top];
}

function drawPipesInFront(ctx: CanvasRenderingContext2D, map: GameState["map"], cam: Camera): void {
  if (!isSpriteReady(overworldSpriteSheet)) return;

  const first = Math.floor(cam.x / TILE);
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = first; tx <= first + SCREEN_W / TILE; tx++) {
      if (tx >= map.width) continue;
      const tileId = map.tiles[ty * map.width + tx];
      if (!isPipeTile(tileId)) continue;

      const frame = pipeSprite(map, tx, ty, tileId) ?? TILE_SPRITES[tileId];
      if (!frame) continue;
      ctx.drawImage(
        overworldSpriteSheet,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        tx * TILE - cam.x,
        ty * TILE - cam.y,
        TILE,
        TILE,
      );
    }
  }
}

function isPipeTile(tileId: number): boolean {
  return tileId === Tile.pipe_left_top || tileId === Tile.pipe_right_top ||
    tileId === Tile.pipe_left_body || tileId === Tile.pipe_right_body;
}

function isPipeAt(map: GameState["map"], tx: number, ty: number): boolean {
  if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) return false;
  return isPipeTile(map.tiles[ty * map.width + tx]);
}

function isSpriteReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, cam: Camera, frameNumber: number): void {
  const frameIndex = Math.floor(frameNumber / 8);
  const moving = enemy.onGround && enemy.vx !== 0;

  if (enemy instanceof HammerBro && isSpriteReady(enemySpriteSheet)) {
    const frame = enemy.state === "throwing"
      ? HAMMER_BRO_FRAMES[3]
      : enemy.state === "moving"
        ? HAMMER_BRO_FRAMES[frameIndex % 2]
        : HAMMER_BRO_FRAMES[0];
    drawSpriteFrame(ctx, enemySpriteSheet, enemy, cam, frame, enemy.dir > 0, 1.1);
    return;
  }

  if (enemy.type === "goomba" && isSpriteReady(enemySpriteSheet)) {
    const frame = GOOMBA_WALK[moving ? frameIndex % GOOMBA_WALK.length : 0];
    drawSpriteFrame(ctx, enemySpriteSheet, enemy, cam, frame, enemy.dir < 0);
    return;
  }

  if (
    enemy instanceof KoopaEnemy &&
    (enemy.type === "koopa" || enemy.type === "koopa_red") &&
    isSpriteReady(enemySpriteSheet)
  ) {
    const shell = enemy.actionState !== "default";
    const frame = shell
      ? KOOPA_SHELL[enemy.actionState === "shell_sliding" ? frameIndex % KOOPA_SHELL.length : 0]
      : KOOPA_WALK[moving ? frameIndex % KOOPA_WALK.length : 0];
    drawSpriteFrame(ctx, enemySpriteSheet, enemy, cam, frame, enemy.dir > 0);
    return;
  }

  box(ctx, enemy, cam, ENEMY_COLORS[enemy.type] || COLORS.enemy);
}

function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  enemy: Body,
  cam: Camera,
  frame: SpriteFrame,
  flip: boolean,
  scale = 1,
): void {
  const drawW = enemy.w * scale;
  const drawH = enemy.h * scale;
  const x = Math.round(enemy.x / SUB - cam.x - (drawW - enemy.w) / 2);
  const y = Math.round(enemy.y / SUB - cam.y - (drawH - enemy.h) / 2);

  ctx.save();
  if (flip) {
    ctx.translate(x + drawW, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }
  ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, drawW, drawH);
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera): void {
  const { player } = state;
  const x = Math.round(player.x / SUB - cam.x - (TILE - player.w) / 2);
  const y = Math.round(player.y / SUB - cam.y);

  if (!isSpriteReady(marioSpriteSheet)) {
    box(ctx, player, cam, COLORS.player);
    return;
  }

  const walking = player.onGround && player.vx !== 0;
  const frame = !player.onGround
    ? MARIO_JUMP
    : walking
      ? MARIO_WALK[Math.floor(state.frame / 7) % MARIO_WALK.length]
      : MARIO_IDLE;
  const drawX = Math.floor((TILE - player.w) / 2);

  ctx.save();
  if (player.facing < 0) {
    ctx.translate(x + TILE, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }
  ctx.drawImage(
    marioSpriteSheet,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    drawX,
    0,
    TILE,
    TILE,
  );
  ctx.restore();
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