
import { BLOCKS, bumpOffset, SCREEN_H, SCREEN_W, SUB, TILE, Tile, TILES, ENEMIES, type Body, type Enemy, type GameState, type SegmentSpan, BulletBill, BulletBillCannon, BuzzyBeetle, Goomba, HammerBro, KoopaEnemy, MiniGoomba, ParaGoomba, ParaGoombaBrown, ParaGoombaRed, PiranhaPlant, Spiny, type Platform } from "../core/index.ts";
import {
 BULLET_BILL,
 BULLET_BILL_CANNON,
 BOWSER_WALK_FRAMES,
 BRIDGE_LOG,
 AXE_FRAME,
 BUZZY_SHELL_FRAMES,
 BUZZY_WALK_FRAMES,
 BUZZY_BEETLE_SHELL,
 BUZZY_BEETLE_WALK,
 COIN_FRAMES,
 BRICK_DEBRIS_FRAMES,
 GOOMBA_WALK,
 GOOMBA_SQUASHED,
  HAMMER_BRO_FRAMES,
  HAMMER_PROJECTILE,
  KOOPA_SHELL,
  KOOPA_WALK,
  MARIO_IDLE,
  MARIO_JUMP,
  MARIO_WALK,
  OVERWORLD_CLOUD,
  OVERWORLD_LARGE_HILL,
  OVERWORLD_SMALL_HILL,
  PIRANHA_PLANT_FRAMES,
  PARATROOPA_WING,
  PODOBOO_FRAMES,
  SPINY_FRAMES,
  TEMP_BULLET_BILL,
  TEMP_BULLET_BILL_CANNON,
  TILE_SPRITES,
  POWERUP_SPRITES,
  type SpriteFrame,
} from "./spriteFrames.ts";

function loadSpriteSheet(path: string): HTMLImageElement {
  const image = new Image();
  image.src = new URL(path, import.meta.url).href;
  return image;
}

const marioSpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/Mario.png");
const enemySpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/Enemies.png");
const temporarySpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/temporary_sprites.png");
const bulletBillSpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/BulletBill.png");
const itemSpriteSheet = loadSpriteSheet("./sprites/Mario1/Misc/Items.png");
const powerupSpriteSheet = loadSpriteSheet("./sprites/Mario1/Misc/Powerups.png");
const overworldSpriteSheet = loadSpriteSheet("./sprites/Mario1/Tilesets/OverWorld.png");
const bridgeSpriteSheet = loadSpriteSheet("./sprites/Mario1/Tilesets/Bridge.png");
const bowserBridgeSpriteSheet = loadSpriteSheet("./sprites/Mario1/Tilesets/BowserBridge.png");
const axeSpriteSheet = loadSpriteSheet("./sprites/Mario1/Misc/Axe.png");
const buzzySpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/Buzzy Beetle1.png");
const wingsSpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/wings.png");
const podobooSpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/Podoboo.png");
const bowserSpriteSheet = loadSpriteSheet("./sprites/Mario1/Characters/Bowser.png");
const tintedTileCache = new Map<string, HTMLCanvasElement>();

const COLORS = {
  sky: "#5C94FC",
  caveBackground: "#17131F",
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
const SOLID_TILE_IDS = new Set(Object.values(TILES).filter((tile) => tile.solid).map((tile) => tile.id));

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
  const caveTheme = state.area === "cave" || state.level.type === "caves";
  ctx.fillStyle = caveTheme ? COLORS.caveBackground : COLORS.sky;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  if (state.area === "overworld" && !caveTheme && isSpriteReady(overworldSpriteSheet)) {
    drawOverworldBackdrop(ctx, state, cam);
  }

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
      
      drawTile(ctx, tileId, x, y, state.frame, map, tx, ty, caveTheme);
    }
  }
  drawTreetops(ctx, map, cam, caveTheme);
  drawBridgeTiles(ctx, map, cam);
  drawBowserBridgeTiles(ctx, map, cam);
  drawAxeTiles(ctx, map, cam, caveTheme);
  
  for (const p of state.platforms) {
    drawPlatform(ctx, p, cam);
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
        const width = HammerBro.HAMMER_WIDTH / SUB;
        const height = HammerBro.HAMMER_HEIGHT / SUB;
        ctx.save();
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate(hammer.rotation);
        if (isSpriteReady(enemySpriteSheet)) {
          ctx.drawImage(
            enemySpriteSheet,
            HAMMER_PROJECTILE.x,
            HAMMER_PROJECTILE.y,
            HAMMER_PROJECTILE.width,
            HAMMER_PROJECTILE.height,
            -width / 2,
            -height / 2,
            width,
            height,
          );
        } else {
          ctx.fillStyle = COLORS.hammer;
          ctx.fillRect(-width / 2, -height / 2, width, height);
        }
        ctx.restore();
      }
    }
  }

  drawPipesInFront(ctx, map, cam);

  ctx.fillStyle = TILE_COLORS[Tile.brick];
  for (const d of state.debris) {
    const frame = BRICK_DEBRIS_FRAMES[d.vx < 0 ? 0 : 1];
    const x = Math.round(d.x / SUB - cam.x);
    const y = Math.round(d.y / SUB - cam.y);
    if (isSpriteReady(overworldSpriteSheet)) {
      drawSpriteSheetFrame(ctx, overworldSpriteSheet, frame, x, y, BLOCKS.debrisPx, BLOCKS.debrisPx, caveTheme);
    } else {
      ctx.fillRect(x, y, BLOCKS.debrisPx, BLOCKS.debrisPx);
      tintCaveTile(ctx, x, y, caveTheme, BLOCKS.debrisPx);
    }
  }
  
  for (const ring of state.redRings) {
    if (ring.area !== state.area) continue;
    const bx = Math.round(ring.x/SUB - cam.x);
    const by = Math.round(ring.y/SUB - cam.y) + 2*TILE;
    ctx.fillStyle = "#606060";
    ctx.fillRect(bx+1,by-4,TILE-2,4);
    if (ring.phase === "waiting") {
      ctx.fillStyle = "#e02020";
      ctx.beginPath();
      ctx.ellipse(bx + TILE/2,by-4,TILE/2-3,6,0,Math.PI,2*Math.PI);
    } else if (ring.phase === "active") {
      ring.coins.forEach((c, i) => {
        if (ring.collected[i]) return;
        const x = Math.round(c.x / SUB - cam.x);
        const y = Math.round(c.y / SUB - cam.y);
        if (isSpriteReady(itemSpriteSheet)) {
          const frame = COIN_FRAMES[Math.floor(state.frame / 8) % COIN_FRAMES.length];
          drawSpriteSheetFrame(ctx, itemSpriteSheet, frame, x, y, TILE, TILE, "rgba(220, 0, 0, 0.82)");
        } else {
          ctx.fillStyle = "#dc0000";
          ctx.beginPath();
          ctx.ellipse(x + TILE / 2, y + TILE / 2, TILE / 4, TILE / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }
  if (state.items) {
    for (const item of state.items) {
      if (!item.alive) continue;

      const drawX = Math.round(item.x / SUB - cam.x);
      const drawY = Math.round(item.y / SUB - cam.y);
      const frame = POWERUP_SPRITES[item.type];

      if (frame && isSpriteReady(powerupSpriteSheet)) {
        ctx.drawImage(
          powerupSpriteSheet,
          frame.x, frame.y, frame.width, frame.height,
          drawX, drawY, item.w, item.h
        );
      } else {
        if (item.type === 'star' && Math.floor(state.frame / 4) % 2 === 0) {
          ctx.fillStyle = "#FFFFFF";
        } else {
          ctx.fillStyle = ITEM_COLORS[item.type] || "#FFFFFF";
        }
        ctx.fillRect(drawX, drawY, item.w, item.h);
      }
    }
  }

  for (const p of state.projectiles) {
    const cx = Math.round(p.x / SUB - cam.x) + p.w / 2;
    const cy = Math.round(p.y / SUB - cam.y) + p.h / 2;
    if (p.type === "hammer") {
      const f = HAMMER_PROJECTILE;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(state.frame * 0.4 * p.dir); // spinning
      if (isSpriteReady(enemySpriteSheet)) {
        ctx.drawImage(enemySpriteSheet, f.x, f.y, f.width, f.height, -f.width / 2, -f.height / 2, f.width, f.height);
      } else {
        ctx.fillStyle = "#696969";
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    } else {
      const fireFrame = PODOBOO_FRAMES[0];
      if (isSpriteReady(podobooSpriteSheet)) {
        ctx.drawImage(
          podobooSpriteSheet,
          fireFrame.x,
          fireFrame.y,
          fireFrame.width,
          fireFrame.height,
          Math.round(p.x / SUB - cam.x),
          Math.round(p.y / SUB - cam.y),
          p.w,
          p.h,
        );
      } else {
        ctx.fillStyle = "#FF6A00";
        ctx.beginPath();
        ctx.arc(cx, cy, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
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
  caveTint: boolean,
): void {
  const tint = caveTint && !isPipeTile(tileId);

  if (tileId === Tile.coin && isSpriteReady(itemSpriteSheet)) {
    const frame = COIN_FRAMES[Math.floor(frameNumber / 8) % COIN_FRAMES.length];
    ctx.drawImage(itemSpriteSheet, frame.x, frame.y, frame.width, frame.height, x, y, TILE, TILE);
    return;
  }

  if (tileId === Tile.flagpole) {
    const isTop = ty === 0 || map.tiles[(ty - 1) * map.width + tx] !== Tile.flagpole;
    ctx.fillStyle = "#315B32";
    ctx.fillRect(x + 6, y, 4, TILE);
    ctx.fillStyle = "#73C94B";
    ctx.fillRect(x + 7, y, 2, TILE);

    if (isTop) {
      ctx.fillStyle = "#815A18";
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFD84D";
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (tileId === Tile.axe) return;
  if (tileId === Tile.bridge) return;
  if (tileId === Tile.bowser_bridge && isSpriteReady(bowserBridgeSpriteSheet)) return;

  if (tileId === Tile.treetop) return;

  if (tileId === Tile.lava && isSpriteReady(overworldSpriteSheet)) {
    const frame = TILE_SPRITES[Tile.floor];
    if (frame) {
      drawSpriteSheetFrame(ctx, overworldSpriteSheet, frame, x, y, TILE, TILE, "rgba(255, 85, 0, 0.76)");
      return;
    }
  }

  const pipe = pipeSprite(map, tx, ty, tileId);
  if (pipe && isSpriteReady(overworldSpriteSheet)) {
    drawPipeSprite(ctx, pipe.frame, x, y, pipe.flipY);
    return;
  }

  const frame = TILE_SPRITES[tileId];
  if (frame && isSpriteReady(overworldSpriteSheet)) {
    drawSpriteSheetFrame(ctx, overworldSpriteSheet, frame, x, y, TILE, TILE, tint);
    return;
  }

  ctx.fillStyle = TILE_COLORS[tileId] || COLORS.block;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = COLORS.blockEdge;
  ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  tintCaveTile(ctx, x, y, tint);
}

interface PipeSprite {
  frame: SpriteFrame;
  flipY: boolean;
}

function pipeSprite(map: GameState["map"], tx: number, ty: number, tileId: number): PipeSprite | undefined {
  if (!isPipeTile(tileId)) return undefined;

  const rightHalf = isPipeAt(map, tx - 1, ty);
  const isBody = tileId === Tile.pipe_left_body || tileId === Tile.pipe_right_body;

  if (isBody) {
    return {
      frame: rightHalf ? TILE_SPRITES[Tile.pipe_right_body]! : TILE_SPRITES[Tile.pipe_left_body]!,
      flipY: false,
    };
  }
  return {
    frame: rightHalf ? TILE_SPRITES[Tile.pipe_right_top]! : TILE_SPRITES[Tile.pipe_left_top]!,
    flipY: isPipeBodyAt(map, tx, ty - 1),
  };
}

function drawPipeSprite(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  x: number,
  y: number,
  flipY: boolean,
): void {
  if (!flipY) {
    drawSpriteSheetFrame(ctx, overworldSpriteSheet, frame, x, y, TILE, TILE, false);
    return;
  }

  ctx.save();
  ctx.translate(x, y + TILE);
  ctx.scale(1, -1);
  drawSpriteSheetFrame(ctx, overworldSpriteSheet, frame, 0, 0, TILE, TILE, false);
  ctx.restore();
}

function drawPipesInFront(ctx: CanvasRenderingContext2D, map: GameState["map"], cam: Camera): void {
  if (!isSpriteReady(overworldSpriteSheet)) return;

  const first = Math.floor(cam.x / TILE);
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = first; tx <= first + SCREEN_W / TILE; tx++) {
      if (tx >= map.width) continue;
      const tileId = map.tiles[ty * map.width + tx];
      if (!isPipeTile(tileId)) continue;

      const sprite = pipeSprite(map, tx, ty, tileId);
      if (!sprite) continue;
      const x = tx * TILE - cam.x;
      const y = ty * TILE - cam.y;
      drawPipeSprite(ctx, sprite.frame, x, y, sprite.flipY);
    }
  }
}

function drawSpriteSheetFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frame: SpriteFrame,
  x: number,
  y: number,
  width: number,
  height: number,
  caveTint: boolean | string,
): void {
  if (!caveTint) {
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, x, y, width, height);
    return;
  }

  const tintColor = typeof caveTint === "string" ? caveTint : "rgba(35, 90, 210, 0.38)";
  const key = `${image.src},${frame.x},${frame.y},${frame.width},${frame.height},${width},${height},${tintColor}`;
  let tinted = tintedTileCache.get(key);
  if (!tinted) {
    tinted = document.createElement("canvas");
    tinted.width = width;
    tinted.height = height;
    const tintedContext = tinted.getContext("2d");
    if (!tintedContext) {
      ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, x, y, width, height);
      return;
    }
    tintedContext.imageSmoothingEnabled = false;
    tintedContext.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, width, height);
    tintedContext.globalCompositeOperation = "source-atop";
    tintedContext.fillStyle = tintColor;
    tintedContext.fillRect(0, 0, width, height);
    tintedTileCache.set(key, tinted);
  }
  ctx.drawImage(tinted, x, y);
}

function drawBridgeTiles(ctx: CanvasRenderingContext2D, map: GameState["map"], cam: Camera): void {
  const first = Math.floor(cam.x / TILE);
  const last = Math.min(map.width - 1, first + SCREEN_W / TILE);
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = first; tx <= last; tx++) {
      if (map.tiles[ty * map.width + tx] !== Tile.bridge) continue;

      const x = Math.round(tx * TILE - cam.x);
      const y = Math.round(ty * TILE - cam.y);
      if (isSpriteReady(bridgeSpriteSheet)) {
        drawSpriteSheetFrame(ctx, bridgeSpriteSheet, BRIDGE_LOG, x, y, TILE / 2, TILE, false);
        drawSpriteSheetFrame(ctx, bridgeSpriteSheet, BRIDGE_LOG, x + TILE / 2, y, TILE / 2, TILE, false);
      }
    }
  }
}

function drawBowserBridgeTiles(ctx: CanvasRenderingContext2D, map: GameState["map"], cam: Camera): void {
  if (!isSpriteReady(bowserBridgeSpriteSheet)) return;

  for (let ty = 0; ty < map.height; ty++) {
    let tx = 0;
    while (tx < map.width) {
      if (map.tiles[ty * map.width + tx] !== Tile.bowser_bridge) {
        tx++;
        continue;
      }

      const start = tx;
      while (tx < map.width && map.tiles[ty * map.width + tx] === Tile.bowser_bridge) tx++;
      const end = tx;
      const segmentStart = start * TILE;
      const segmentEnd = end * TILE;
      const spriteWidth = 3 * TILE;
      const height = spriteWidth * bowserBridgeSpriteSheet.naturalHeight / bowserBridgeSpriteSheet.naturalWidth;

      for (let worldX = segmentStart; worldX < segmentEnd; worldX += spriteWidth) {
        const x = Math.round(worldX - cam.x);
        const y = Math.round((ty + 1) * TILE - cam.y - height);
        const clipWidth = Math.min(spriteWidth, segmentEnd - worldX);
        if (worldX + clipWidth < cam.x || worldX > cam.x + SCREEN_W) continue;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, clipWidth, height);
        ctx.clip();
        ctx.drawImage(bowserBridgeSpriteSheet, x, y, spriteWidth, height);
        ctx.restore();
      }
    }
  }
}

function drawAxeTiles(
  ctx: CanvasRenderingContext2D,
  map: GameState["map"],
  cam: Camera,
  caveTint: boolean,
): void {
  const first = Math.floor(cam.x / TILE);
  const last = Math.min(map.width - 1, first + SCREEN_W / TILE);
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = first; tx <= last; tx++) {
      if (map.tiles[ty * map.width + tx] !== Tile.axe) continue;

      const x = Math.round(tx * TILE - cam.x);
      const y = Math.round(ty * TILE - cam.y);
      if (isSpriteReady(axeSpriteSheet)) {
        drawSpriteSheetFrame(ctx, axeSpriteSheet, AXE_FRAME, x, y - 8, TILE, 24, caveTint);
      } else {
        ctx.fillStyle = TILE_COLORS[Tile.axe];
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
}

function drawTreetops(
  ctx: CanvasRenderingContext2D,
  map: GameState["map"],
  cam: Camera,
  caveTint: boolean,
): void {
  for (let ty = 0; ty < map.height; ty++) {
    let tx = 0;
    while (tx < map.width) {
      if (map.tiles[ty * map.width + tx] !== Tile.treetop) {
        tx++;
        continue;
      }

      const start = tx;
      while (tx < map.width && map.tiles[ty * map.width + tx] === Tile.treetop) tx++;
      const end = tx;
      if (end * TILE < cam.x || start * TILE > cam.x + SCREEN_W) continue;

      const x = Math.round(start * TILE - cam.x);
      const y = Math.round(ty * TILE - cam.y);
      const width = (end - start) * TILE;
      drawTreetopCanopy(ctx, x, y, width);

      for (let treeX = start; treeX < end; treeX++) {
        for (let trunkRow = 1; trunkRow <= 3; trunkRow++) {
          const mapY = ty + trunkRow;
          if (mapY < map.height && map.tiles[mapY * map.width + treeX] !== Tile.air) break;
          const trunkX = Math.round(treeX * TILE - cam.x);
          const trunkY = Math.round(mapY * TILE - cam.y);
          const isLeftEdge = treeX === start;
          const isRightEdge = treeX === end - 1;
          drawTreeTrunkTile(ctx, trunkX, trunkY, treeX, trunkRow, isLeftEdge, isRightEdge);
          const leftInset = isLeftEdge ? (isRightEdge ? TILE / 4 : TILE / 2) : 0;
          const rightInset = isRightEdge ? (isLeftEdge ? TILE / 4 : TILE / 2) : 0;
          tintCaveTile(ctx, trunkX + leftInset, trunkY, caveTint, TILE - leftInset - rightInset);
        }
      }
      if (caveTint) {
        ctx.fillStyle = "rgba(35, 90, 210, 0.38)";
        ctx.fillRect(x, y, width, TILE);
      }
    }
  }
}

function drawTreetopCanopy(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  const right = x + width;
  ctx.fillStyle = "#263522";
  ctx.beginPath();
  ctx.moveTo(x + 3, y);
  ctx.lineTo(right - 3, y);
  ctx.lineTo(right - 3, y + 1);
  ctx.lineTo(right - 1, y + 1);
  ctx.lineTo(right - 1, y + 3);
  ctx.lineTo(right, y + 3);
  ctx.lineTo(right, y + 13);
  ctx.lineTo(right - 2, y + 15);
  ctx.lineTo(x + 2, y + 15);
  ctx.lineTo(x, y + 13);
  ctx.lineTo(x, y + 3);
  ctx.lineTo(x + 1, y + 1);
  ctx.lineTo(x + 3, y + 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#9dcc32";
  ctx.fillRect(x + 3, y + 2, width - 6, 1);
  ctx.fillRect(x + 2, y + 3, width - 4, 10);
  ctx.fillRect(x + 1, y + 13, width - 2, 1);
  ctx.fillRect(x + 2, y + 14, width - 4, 1);
  ctx.fillRect(x + 2, y + 15, width - 4, 1);

  ctx.fillStyle = "#c5e85a";
  ctx.fillRect(x + 4, y + 2, width - 8, 1);
  ctx.fillRect(x + 2, y + 4, 1, 6);
}

function drawTreeTrunkTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  column: number,
  row: number,
  isLeftEdge: boolean,
  isRightEdge: boolean,
): void {
  const leftInset = isLeftEdge ? (isRightEdge ? TILE / 4 : TILE / 2) : 0;
  const rightInset = isRightEdge ? (isLeftEdge ? TILE / 4 : TILE / 2) : 0;
  const trunkX = x + leftInset;
  const trunkWidth = TILE - leftInset - rightInset;
  ctx.fillStyle = "#56351f";
  ctx.fillRect(trunkX, y, trunkWidth, TILE);
  ctx.fillStyle = "#b96f35";
  ctx.fillRect(trunkX + 1, y + 1, trunkWidth - 2, TILE - 2);
  ctx.fillStyle = "#d18a48";
  ctx.fillRect(trunkX + 2, y + 2, 1, TILE - 4);
  ctx.fillRect(trunkX + Math.max(4, Math.floor(trunkWidth * 0.6)), y + 2, 1, TILE - 4);
  ctx.fillStyle = "#764323";

  if ((column + row) % 2 === 0) {
    for (let step = 0; step < Math.min(5, trunkWidth - 3); step++) {
      ctx.fillRect(trunkX + trunkWidth - 4 - step, y + 3 + step * 2, 2, 2);
    }
  } else {
    const startX = Math.max(1, Math.floor(trunkWidth / 4));
    for (let step = 0; step < Math.min(4, trunkWidth - 3); step++) {
      ctx.fillRect(trunkX + startX + step, y + 4 + step * 2, 2, 2);
    }
  }
}

function tintCaveTile(ctx: CanvasRenderingContext2D, x: number, y: number, caveTint: boolean, size = TILE): void {
  if (!caveTint) return;
  ctx.fillStyle = "rgba(35, 90, 210, 0.38)";
  ctx.fillRect(x, y, size, size);
}

function isPipeTile(tileId: number): boolean {
  return tileId === Tile.pipe_left_top || tileId === Tile.pipe_right_top ||
    tileId === Tile.pipe_left_body || tileId === Tile.pipe_right_body;
}

function isPipeAt(map: GameState["map"], tx: number, ty: number): boolean {
  if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) return false;
  return isPipeTile(map.tiles[ty * map.width + tx]);
}

function isPipeBodyAt(map: GameState["map"], tx: number, ty: number): boolean {
  if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) return false;
  const tileId = map.tiles[ty * map.width + tx];
  return tileId === Tile.pipe_left_body || tileId === Tile.pipe_right_body;
}

function isSpriteReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

function drawOverworldBackdrop(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera): void {
  const cloudSpacing = 7 * TILE;
  const firstCloud = Math.floor((cam.x - cloudSpacing) / cloudSpacing);
  const lastCloud = Math.ceil((cam.x + SCREEN_W) / cloudSpacing);

  for (let chunk = firstCloud; chunk <= lastCloud; chunk++) {
    const seed = positionHash(chunk * 2 + 17);
    if (seed % 4 === 0) continue;

    const worldX = chunk * cloudSpacing + 8 + (seed % 48);
    const worldY = 84 + ((seed >>> 8) % 5) * 12;
    const x = Math.round(worldX - cam.x);
    const y = Math.round(worldY - cam.y);
    ctx.drawImage(
      overworldSpriteSheet,
      OVERWORLD_CLOUD.x,
      OVERWORLD_CLOUD.y,
      OVERWORLD_CLOUD.width,
      OVERWORLD_CLOUD.height,
      x,
      y,
      OVERWORLD_CLOUD.width,
      OVERWORLD_CLOUD.height,
    );
  }

  const hillSpacing = 12 * TILE;
  const firstHill = Math.floor((cam.x - hillSpacing) / hillSpacing);
  const lastHill = Math.ceil((cam.x + SCREEN_W) / hillSpacing);

  for (let chunk = firstHill; chunk <= lastHill; chunk++) {
    const seed = positionHash(chunk * 2 + 53);
    if (seed % 3 === 0) continue;

    const large = seed % 5 === 0;
    const preferredX = chunk * hillSpacing + 12 + (seed % 52);
    const placement = large
      ? findGroundPlacement(
          state.map,
          preferredX,
          OVERWORLD_LARGE_HILL.width,
          OVERWORLD_LARGE_HILL.height,
          chunk * hillSpacing,
          (chunk + 1) * hillSpacing,
        )
      : undefined;
    const frame = placement
      ? OVERWORLD_LARGE_HILL
      : OVERWORLD_SMALL_HILL;
    const ground = placement ?? findGroundPlacement(
      state.map,
      preferredX,
      frame.width,
      frame.height,
      chunk * hillSpacing,
      (chunk + 1) * hillSpacing,
    );
    if (!ground) continue;

    const x = Math.round(ground.x - cam.x);
    const y = Math.round(ground.y - cam.y - frame.height);
    drawSpriteSheetFrame(ctx, overworldSpriteSheet, frame, x, y, frame.width, frame.height, false);
  }
}

function findGroundPlacement(
  map: GameState["map"],
  preferredX: number,
  width: number,
  height: number,
  chunkStartX: number,
  chunkEndX: number,
): { x: number; y: number } | undefined {
  const minTile = Math.max(0, Math.ceil(chunkStartX / TILE));
  const maxTile = Math.min(
    map.width - Math.ceil(width / TILE),
    Math.floor((chunkEndX - width) / TILE),
  );
  if (minTile > maxTile) return undefined;

  const preferredTile = Math.max(minTile, Math.min(maxTile, Math.round(preferredX / TILE)));
  for (let distance = 0; preferredTile - distance >= minTile || preferredTile + distance <= maxTile; distance++) {
    const candidates = distance === 0
      ? [preferredTile]
      : [preferredTile - distance, preferredTile + distance];
    for (const tx of candidates) {
      if (tx < minTile || tx > maxTile) continue;
      const x = tx * TILE;
      const y = groundSurfaceY(map, x, width, height);
      if (y !== undefined) return { x, y };
    }
  }
  return undefined;
}

function groundSurfaceY(
  map: GameState["map"],
  worldX: number,
  width: number,
  height: number,
): number | undefined {
  const firstTile = Math.floor(worldX / TILE);
  const lastTile = Math.floor((worldX + width - 1) / TILE);
  const supportFirstTile = firstTile - 1;
  const supportLastTile = lastTile + 1;
  if (supportFirstTile < 0 || supportLastTile >= map.width) return undefined;

  let surfaceY: number | undefined;
  for (let tx = supportFirstTile; tx <= supportLastTile; tx++) {
    let ty = map.height - 1;
    while (ty >= 0 && SOLID_TILE_IDS.has(map.tiles[ty * map.width + tx])) ty--;
    if (ty === map.height - 1) return undefined;

    const columnSurfaceY = (ty + 1) * TILE;
    if (surfaceY !== undefined && columnSurfaceY !== surfaceY) return undefined;
    surfaceY = columnSurfaceY;
  }

  if (surfaceY === undefined) return undefined;
  const firstClearRow = Math.max(0, Math.floor((surfaceY - height) / TILE));
  const lastClearRow = Math.floor((surfaceY - 1) / TILE);
  for (let tx = firstTile; tx <= lastTile; tx++) {
    for (let ty = firstClearRow; ty <= lastClearRow; ty++) {
      if (SOLID_TILE_IDS.has(map.tiles[ty * map.width + tx])) return undefined;
    }
  }
  return surfaceY;
}

function positionHash(value: number): number {
  let hash = Math.imul(value ^ 0x45d9f3b, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, cam: Camera, frameNumber: number): void {
  const frameIndex = Math.floor(frameNumber / 8);
  const moving = enemy.onGround && enemy.vx !== 0;

  if (enemy.type === "bowser" && isSpriteReady(bowserSpriteSheet)) {
    const frame = BOWSER_WALK_FRAMES[moving ? frameIndex % BOWSER_WALK_FRAMES.length : 0];
    drawSpriteFrame(ctx, bowserSpriteSheet, enemy, cam, frame, enemy.dir > 0);
    return;
  }

  if (enemy.type === "podoboo") {
    if (isSpriteReady(podobooSpriteSheet)) {
      const frame = PODOBOO_FRAMES[Math.floor(frameNumber / 6) % PODOBOO_FRAMES.length];
      const x = Math.round(enemy.x / SUB - cam.x + (enemy.w - frame.width) / 2);
      const y = Math.round(enemy.y / SUB - cam.y + enemy.h - frame.height);
      ctx.drawImage(
        podobooSpriteSheet,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        x,
        y,
        frame.width,
        frame.height,
      );
    } else {
      box(ctx, enemy, cam, ENEMY_COLORS[enemy.type] || COLORS.enemy);
    }
    return;
  }

  if (enemy.type === "buzzy_beetle" && isSpriteReady(buzzySpriteSheet)) {
    const shell = enemy.actionState === "shell_idle" || enemy.actionState === "shell_sliding";
    const frames = shell ? BUZZY_SHELL_FRAMES : BUZZY_WALK_FRAMES;
    const frame = frames[moving || enemy.actionState === "shell_sliding" ? frameIndex % frames.length : 0];
    drawSpriteFrame(ctx, buzzySpriteSheet, enemy, cam, frame, enemy.dir > 0);
    return;
  }

  if (enemy instanceof MiniGoomba) {
    drawMiniGoomba(ctx, enemy, cam);
    return;
  }

  if (enemy instanceof ParaGoomba) {
    drawParaGoomba(ctx, enemy, cam, frameNumber);
    return;
  }

  if (enemy instanceof BulletBillCannon) {
    if (isSpriteReady(bulletBillSpriteSheet)) {
      drawSpriteFrame(
        ctx,
        bulletBillSpriteSheet,
        { x: enemy.x + 2 * SUB, y: enemy.y + 0.5 * SUB, w: 12, h: 15 },
        cam,
        BULLET_BILL_CANNON,
        false,
      );
    } else if (isSpriteReady(temporarySpriteSheet)) {
      drawSpriteFrame(ctx, temporarySpriteSheet, enemy, cam, TEMP_BULLET_BILL_CANNON, false);
    } else {
      drawBulletBillCannon(ctx, enemy, cam);
    }
    return;
  }

  if (enemy instanceof BulletBill) {
    if (isSpriteReady(bulletBillSpriteSheet)) {
      drawSpriteFrame(
        ctx,
        bulletBillSpriteSheet,
        { x: enemy.x, y: enemy.y + 3 * SUB, w: 16, h: 10 },
        cam,
        BULLET_BILL,
        enemy.dir > 0,
      );
    } else if (isSpriteReady(temporarySpriteSheet)) {
      drawSpriteFrame(ctx, temporarySpriteSheet, enemy, cam, TEMP_BULLET_BILL, enemy.dir > 0);
    } else {
      drawBulletBill(ctx, enemy, cam);
    }
    return;
  }

  if (enemy instanceof BuzzyBeetle && isSpriteReady(temporarySpriteSheet)) {
    if (enemy.actionState === "shell_idle" || enemy.actionState === "shell_sliding") {
      drawSpriteFrame(
        ctx,
        temporarySpriteSheet,
        { x: enemy.x, y: enemy.y + 6 * SUB, w: enemy.w, h: 10 },
        cam,
        BUZZY_BEETLE_SHELL,
        enemy.dir > 0,
      );
    } else {
      const frame = BUZZY_BEETLE_WALK[moving ? frameIndex % BUZZY_BEETLE_WALK.length : 0];
      drawSpriteFrame(ctx, temporarySpriteSheet, enemy, cam, frame, enemy.dir > 0);
    }
    return;
  }

  if (enemy instanceof Spiny && isSpriteReady(enemySpriteSheet)) {
    const frame = SPINY_FRAMES[moving ? frameIndex % SPINY_FRAMES.length : 0];
    drawSpriteFrame(ctx, enemySpriteSheet, enemy, cam, frame, enemy.dir > 0);
    return;
  }

  if (enemy instanceof HammerBro && isSpriteReady(enemySpriteSheet)) {
    const frame = enemy.state === "throwing"
      ? HAMMER_BRO_FRAMES[
          2 + Math.floor(
            (HammerBro.THROW_ANIMATION_DURATION - enemy.throwAnimationTimer) / 4,
          ) % 2
        ]
      : enemy.state === "moving"
        ? HAMMER_BRO_FRAMES[frameIndex % 2]
        : HAMMER_BRO_FRAMES[0];
    drawSpriteFrame(ctx, enemySpriteSheet, enemy, cam, frame, enemy.dir > 0, 1.1);
    return;
  }

  if (enemy instanceof Goomba && isSpriteReady(enemySpriteSheet)) {
    if (enemy.squashTimer > 0) {
      drawSquashedGoomba(ctx, enemy, cam);
      return;
    }
    const frame = GOOMBA_WALK[moving ? frameIndex % GOOMBA_WALK.length : 0];
    for (let i = 0; i < enemy.stackCount; i++) {
      drawSpriteFrame(
        ctx,
        enemySpriteSheet,
        { x: enemy.x, y: enemy.y + i * enemy.cfg.h * SUB, w: enemy.w, h: enemy.cfg.h },
        cam,
        frame,
        enemy.dir < 0,
      );
    }
    return;
  }

  if (
    enemy instanceof KoopaEnemy &&
    (enemy.type === "koopa" || enemy.type === "koopa_red" || enemy.type === "koopa_para" || enemy.type === "koopa_para_red") &&
    isSpriteReady(enemySpriteSheet)
  ) {
    const shell = enemy.actionState !== "default";
    const frame = shell
      ? KOOPA_SHELL[enemy.actionState === "shell_sliding" ? frameIndex % KOOPA_SHELL.length : 0]
      : KOOPA_WALK[moving ? frameIndex % KOOPA_WALK.length : 0];
    drawSpriteFrame(
      ctx,
      enemySpriteSheet,
      enemy,
      cam,
      frame,
      enemy.dir > 0,
      1,
      enemy.type === "koopa_red" || enemy.type === "koopa_para_red",
    );

    if ("hasWings" in enemy && enemy.hasWings === true && isSpriteReady(wingsSpriteSheet)) {
      const wingWidth = 15;
      const wingOffsetX = 3;
      const mirroredWingOffsetX = enemy.w - wingOffsetX - wingWidth;
      drawSpriteFrame(
        ctx,
        wingsSpriteSheet,
        {
          x: enemy.x + (enemy.dir > 0 ? mirroredWingOffsetX : wingOffsetX) * SUB,
          y: enemy.y + 1 * SUB,
          w: wingWidth,
          h: 15,
        },
        cam,
        PARATROOPA_WING,
        enemy.dir > 0,
      );
    }
    return;
  }

  box(ctx, enemy, cam, ENEMY_COLORS[enemy.type] || COLORS.enemy);
}

function drawBulletBill(ctx: CanvasRenderingContext2D, bill: BulletBill, cam: Camera): void {
  const x = Math.round(bill.x / SUB - cam.x);
  const y = Math.round(bill.y / SUB - cam.y);
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, bill.w, bill.h);
}

function drawBulletBillCannon(ctx: CanvasRenderingContext2D, cannon: BulletBillCannon, cam: Camera): void {
  const x = Math.round(cannon.x / SUB - cam.x);
  const y = Math.round(cannon.y / SUB - cam.y);
  ctx.fillStyle = "#444";
  ctx.fillRect(x, y, cannon.w, cannon.h);
}

function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  enemy: Pick<Body, "x" | "y" | "w" | "h">,
  cam: Camera,
  frame: SpriteFrame,
  flip: boolean,
  scale = 1,
  recolorGreenToRed = false,
): void {
  const drawW = enemy.w * scale;
  const drawH = enemy.h * scale;
  const x = Math.round(enemy.x / SUB - cam.x - (drawW - enemy.w) / 2);
  const y = Math.round(enemy.y / SUB - cam.y - (drawH - enemy.h) / 2);
  let source: CanvasImageSource = image;
  let sourceFrame = frame;
  if (recolorGreenToRed) {
    const key = `${image.src},${frame.x},${frame.y},${frame.width},${frame.height},green-to-red`;
    let tinted = tintedTileCache.get(key);
    if (!tinted) {
      tinted = document.createElement("canvas");
      tinted.width = frame.width;
      tinted.height = frame.height;
      const tintedContext = tinted.getContext("2d");
      if (tintedContext) {
        tintedContext.imageSmoothingEnabled = false;
        tintedContext.drawImage(
          image,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          0,
          0,
          frame.width,
          frame.height,
        );
        const pixels = tintedContext.getImageData(0, 0, frame.width, frame.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const red = pixels.data[i];
          const green = pixels.data[i + 1];
          const blue = pixels.data[i + 2];
          if (green > 40 && green > red * 1.15 && green > blue * 1.1) {
            pixels.data[i] = green;
            pixels.data[i + 1] = Math.round(green * 0.16);
            pixels.data[i + 2] = Math.round(green * 0.08);
          }
        }
        tintedContext.putImageData(pixels, 0, 0);
        tintedTileCache.set(key, tinted);
      }
    }
    if (tinted) {
      source = tinted;
      sourceFrame = { x: 0, y: 0, width: frame.width, height: frame.height };
    }
  }

  ctx.save();
  if (flip) {
    ctx.translate(x + drawW, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }
  ctx.drawImage(source, sourceFrame.x, sourceFrame.y, sourceFrame.width, sourceFrame.height, 0, 0, drawW, drawH);
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


function drawPlatform(ctx: CanvasRenderingContext2D, platform: Platform, cam: Camera): void {
  const x = Math.round(platform.x / SUB - cam.x);
  const y = Math.round(platform.y / SUB - cam.y);
  const w = platform.w;
  const h = platform.h;

  if (x + w < 0 || x > SCREEN_W || y + h < 0 || y > SCREEN_H) return;

  // Platform top surface (highlight)
  ctx.fillStyle = "#FFA044";
  ctx.fillRect(x, y, w, 2);

  // Platform body
  ctx.fillStyle = "#D85000";
  ctx.fillRect(x, y + 2, w, Math.max(0, h - 4));

  // Platform bottom (shadow)
  ctx.fillStyle = "#8C2800";
  ctx.fillRect(x, y + Math.max(2, h - 2), w, 2);

  // Outline
  ctx.strokeStyle = "#000000";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawMiniGoomba(ctx: CanvasRenderingContext2D, enemy: MiniGoomba, cam: Camera): void {
  const x = Math.round(enemy.x / SUB - cam.x);
  const y = Math.round(enemy.y / SUB - cam.y);
  ctx.save();
  ctx.fillStyle = "#8B4513";
  ctx.beginPath();
  ctx.arc(x + 4, y + 4, 4, Math.PI, 0);
  ctx.lineTo(x + 8, y + 7);
  ctx.lineTo(x, y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 2, y + 3, 1, 2);
  ctx.fillRect(x + 5, y + 3, 1, 2);
  ctx.fillStyle = "#000";
  ctx.fillRect(x + 2, y + 4, 1, 1);
  ctx.fillRect(x + 5, y + 4, 1, 1);
  ctx.restore();
}

function drawParaGoomba(
  ctx: CanvasRenderingContext2D,
  enemy: ParaGoomba,
  cam: Camera,
  frameNumber: number,
): void {
  const frameIndex = Math.floor(frameNumber / 8);
  const moving = enemy.onGround && enemy.vx !== 0;
  const isRed = enemy instanceof ParaGoombaRed || enemy.type.includes("red");
  const x = Math.round(enemy.x / SUB - cam.x);
  const y = Math.round(enemy.y / SUB - cam.y);

  if (!enemy.hasWings) {
    if (isSpriteReady(enemySpriteSheet)) {
      if (enemy.squashTimer > 0) {
        drawSquashedGoomba(ctx, enemy, cam);
        return;
      }
      const frame = GOOMBA_WALK[moving ? frameIndex % GOOMBA_WALK.length : 0];
      drawParaGoombaSprite(ctx, enemy, cam, frame, isRed, x, y);
    } else {
      box(ctx, enemy, cam, isRed ? "#cc2828" : "#d9a400");
    }
    return;
  }

  if (isSpriteReady(enemySpriteSheet)) {
    const frame = GOOMBA_WALK[moving ? frameIndex % GOOMBA_WALK.length : 0];
    if (isSpriteReady(wingsSpriteSheet)) {
      const wingY = Math.floor(frameNumber / 6) % 2 === 0 ? 1 : -2;
      drawSpriteFrame(
        ctx,
        wingsSpriteSheet,
        { x: enemy.x - 5 * SUB, y: enemy.y + wingY * SUB, w: 6, h: 10 },
        cam,
        PARATROOPA_WING,
        false,
      );
      drawSpriteFrame(
        ctx,
        wingsSpriteSheet,
        { x: enemy.x + (enemy.w - 1) * SUB, y: enemy.y + wingY * SUB, w: 6, h: 10 },
        cam,
        PARATROOPA_WING,
        true,
      );
    }
    drawParaGoombaSprite(ctx, enemy, cam, frame, isRed, x, y);
  } else {
    box(ctx, enemy, cam, isRed ? "#cc2828" : "#d9a400");
  }
}

function drawParaGoombaSprite(
  ctx: CanvasRenderingContext2D,
  enemy: ParaGoomba,
  cam: Camera,
  frame: SpriteFrame,
  isRed: boolean,
  x: number,
  y: number,
): void {
  ctx.save();
  if (enemy.dir < 0) {
    ctx.translate(2 * x + enemy.w, 0);
    ctx.scale(-1, 1);
  }
  drawSpriteSheetFrame(
    ctx,
    enemySpriteSheet,
    frame,
    x,
    y,
    enemy.w,
    enemy.h,
    isRed ? "rgba(220,40,40,0.35)" : false,
  );
  ctx.restore();
}

function drawSquashedGoomba(ctx: CanvasRenderingContext2D, enemy: Goomba, cam: Camera): void {
  const x = Math.round(enemy.x / SUB - cam.x + (enemy.w - GOOMBA_SQUASHED.width) / 2);
  const y = Math.round(enemy.y / SUB - cam.y + enemy.h - GOOMBA_SQUASHED.height);
  ctx.drawImage(
    enemySpriteSheet,
    GOOMBA_SQUASHED.x,
    GOOMBA_SQUASHED.y,
    GOOMBA_SQUASHED.width,
    GOOMBA_SQUASHED.height,
    x,
    y,
    GOOMBA_SQUASHED.width,
    GOOMBA_SQUASHED.height,
  );
}
