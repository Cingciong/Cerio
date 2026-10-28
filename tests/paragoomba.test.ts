import { expect, test } from "vitest";
import {
  createEnemy,
  createState,
  loadLevel,
  step,
  SUB,
  TILE_SUB,
  MiniGoomba,
  ParaGoomba,
  ParaGoombaBrown,
  ParaGoombaRed,
  Goomba,
  type LevelFile,
  createTileMap,
  Tile,
} from "../core/index.ts";

function makeFlatMap(width = 30, height = 15) {
  const map = createTileMap(width, height);
  for (let x = 0; x < width; x++) {
    map.tiles[(height - 1) * width + x] = Tile.floor;
  }
  return map;
}

test("createEnemy creates correct Paragoomba and MiniGoomba instances", () => {
  const brown1 = createEnemy(1, "para_goomba", 100, 100);
  const brown2 = createEnemy(2, "para_goomba_brown", 100, 100);
  const brown3 = createEnemy(3, "goomba_para", 100, 100);
  const red1 = createEnemy(4, "para_goomba_red", 100, 100);
  const red2 = createEnemy(5, "goomba_para_red", 100, 100);
  const mini = createEnemy(6, "mini_goomba", 100, 100);

  expect(brown1).toBeInstanceOf(ParaGoombaBrown);
  expect(brown2).toBeInstanceOf(ParaGoombaBrown);
  expect(brown3).toBeInstanceOf(ParaGoombaBrown);
  expect(red1).toBeInstanceOf(ParaGoombaRed);
  expect(red2).toBeInstanceOf(ParaGoombaRed);
  expect(mini).toBeInstanceOf(MiniGoomba);

  expect((brown1 as ParaGoomba).hasWings).toBe(true);
  expect((red1 as ParaGoomba).hasWings).toBe(true);
  expect(mini.stompable).toBe(false);
});

test("Red Paragoomba walks on ground, then hops 3 times towards player with 3rd jump highest", () => {
  const map = makeFlatMap();
  const groundY = (15 - 2) * TILE_SUB; // 1 tile above bottom floor
  const red = new ParaGoombaRed(1, "para_goomba_red", 10 * TILE_SUB, groundY);
  // Player is to the right of red paragoomba
  const dummyPlayer = { x: 20 * TILE_SUB, y: groundY, w: 12, h: 16 } as any;

  expect(red.state).toBe("walking");
  expect(red.hasWings).toBe(true);

  // Advance frames until walkTimer expires
  red.walkTimer = 1;
  const buttons = red.decide(map, dummyPlayer);
  red.update(buttons, map, dummyPlayer);

  // Enters ground_pause before jump 1
  expect(red.state).toBe("ground_pause");
  expect(red.jumpCount).toBe(1);

  // Finish ground delay
  for (let i = 0; i < ParaGoombaRed.GROUND_DELAY; i++) {
    red.update(0, map, dummyPlayer);
  }

  // Jump 1 should be active: direction towards player (dir = 1), small hop
  expect(red.state).toBe("jumping");
  expect(red.dir).toBe(1);
  expect(red.vy).toBe(-ParaGoombaRed.HOP_VY);

  // Update until red lands back on ground
  while (red.state === "jumping") {
    red.update(red.decide(map, dummyPlayer), map, dummyPlayer);
  }

  // Landed! Should now be in ground_pause for jump 2
  expect(red.state).toBe("ground_pause");
  expect(red.jumpCount).toBe(2);

  // Finish ground delay for jump 2
  for (let i = 0; i < ParaGoombaRed.GROUND_DELAY; i++) {
    red.update(0, map, dummyPlayer);
  }

  // Jump 2 is small hop
  expect(red.state).toBe("jumping");
  expect(red.vy).toBe(-ParaGoombaRed.HOP_VY);

  // Land jump 2
  while ((red.state as string) === "jumping") {
    red.update(red.decide(map, dummyPlayer), map, dummyPlayer);
  }

  // Landed! Should now be in ground_pause for jump 3
  expect(red.state).toBe("ground_pause");
  expect(red.jumpCount).toBe(3);

  // Place player to the left now to verify it aims towards player on jump 3!
  dummyPlayer.x = 2 * TILE_SUB;

  // Finish ground delay for jump 3
  for (let i = 0; i < ParaGoombaRed.GROUND_DELAY; i++) {
    red.update(0, map, dummyPlayer);
  }

  // Jump 3 must be towards player (dir = -1) AND highest jump
  expect(red.state).toBe("jumping");
  expect(red.dir).toBe(-1);
  expect(red.vy).toBe(-ParaGoombaRed.HIGH_JUMP_VY);
  expect(Math.abs(ParaGoombaRed.HIGH_JUMP_VY)).toBeGreaterThan(Math.abs(ParaGoombaRed.HOP_VY));

  // Land jump 3
  while ((red.state as string) === "jumping") {
    red.update(red.decide(map, dummyPlayer), map, dummyPlayer);
  }

  // After 3rd jump lands, cycles back to walking
  expect(red.state).toBe("walking");
  expect(red.jumpCount).toBe(0);
});

test("Stomping Red Paragoomba turns it into a normal Goomba, second stomp kills it", () => {
  const red = new ParaGoombaRed(1, "para_goomba_red", 100, 100);
  expect(red.hasWings).toBe(true);

  // First stomp: loses wings and turns into normal Goomba
  const bounce1 = red.onStomp(100);
  expect(bounce1).toBe(true);
  expect(red.hasWings).toBe(false);
  expect(red.type).toBe("goomba");
  expect(red.alive).toBe(true);

  // Second stomp: kills normal Goomba
  const bounce2 = red.onStomp(100);
  expect(bounce2).toBe(true);
  expect(red.alive).toBe(false);
});

test("Brown Paragoomba walks, flies up, hovers left/right dropping mini goombas, then descends", () => {
  const map = makeFlatMap();
  const groundY = (15 - 2) * TILE_SUB;
  const brown = new ParaGoombaBrown(1, "para_goomba", 10 * TILE_SUB, groundY);

  expect(brown.state).toBe("walking");
  expect(brown.hasWings).toBe(true);

  // Force walkTimer to expire
  brown.walkTimer = 1;
  brown.update(brown.decide(map), map);

  // Should enter takeoff phase ("podlatuje w powietrze")
  expect(brown.state).toBe("takeoff");
  expect(brown.vy).toBeLessThan(0); // moving up into the air

  // Advance through takeoff until flying
  while (brown.state === "takeoff") {
    brown.update(brown.decide(map), map);
  }

  // In flying state: vy is 0, airborne
  expect(brown.state).toBe("flying");
  expect(brown.vy).toBe(0);

  // Fast-forward drop timer to trigger mini goomba drop
  brown.dropTimer = 1;
  brown.update(brown.decide(map), map);

  // A mini goomba is ready to be dropped
  const mini = brown.takeMiniGoomba(99);
  expect(mini).toBeInstanceOf(MiniGoomba);
  expect(mini?.id).toBe(99);
  expect(mini?.stompable).toBe(false);

  // Test left/right oscillation during flight
  const initialDir = brown.dir;
  brown.turnTimer = 1;
  brown.update(brown.decide(map), map);
  expect(brown.dir).toBe(-initialDir); // reversed direction

  // Fast forward flight timer to expiration
  brown.flyTimer = 1;
  brown.update(brown.decide(map), map);

  // Enters descending phase ("po czym opada")
  expect(brown.state).toBe("descending");
  expect(brown.vy).toBeGreaterThan(0); // gravity active

  // Wait until it lands on ground
  while (brown.state === "descending") {
    brown.update(brown.decide(map), map);
  }

  // Back to walking!
  expect(brown.state).toBe("walking");
});

test("Stomping Brown Paragoomba while flying removes wings and drops it to ground as normal Goomba", () => {
  const brown = new ParaGoombaBrown(1, "para_goomba", 100, 100);
  brown.state = "flying";
  expect(brown.hasWings).toBe(true);

  // Stomp in flight
  const bounce1 = brown.onStomp(100);
  expect(bounce1).toBe(true);
  expect(brown.hasWings).toBe(false);
  expect(brown.type).toBe("goomba");
  expect(brown.alive).toBe(true);

  // Second stomp
  const bounce2 = brown.onStomp(100);
  expect(bounce2).toBe(true);
  expect(brown.alive).toBe(false);
});

test("Mini Goomba falls like a bomb, doesn't stop on floor, and falls off map if not hitting player", () => {
  const map = makeFlatMap();
  const mini = new MiniGoomba(1, 10 * TILE_SUB, 5 * TILE_SUB);
  expect(mini.stompable).toBe(false);
  expect(mini.alive).toBe(true);

  // Let it fall for many frames
  for (let i = 0; i < 200; i++) {
    mini.update(0, map);
  }

  // Has fallen past map height and died
  expect(mini.alive).toBe(false);
});

test("Simulation integration: Mini Goomba damages player and explodes like a bomb on hit", () => {
  const testLevel: LevelFile = {
    name: "paragoomba-test",
    rows: [
      "....................",
      "....................",
      "....................",
      "....................",
      "####################",
    ],
    player: { x: 5, y: 3 },
    enemies: [
      { type: "mini_goomba", x: 5, y: 2 },
    ],
  };

  const state = createState(loadLevel(testLevel));
  state.player.powerState = "big";
  expect(state.enemies.length).toBe(1);
  const mini = state.enemies[0];

  // Step simulation: mini goomba falls onto player
  for (let i = 0; i < 15; i++) {
    step(state, 0);
  }

  // Mini goomba hit player: exploded (alive = false) and player took damage (big -> small)
  expect(mini.alive).toBe(false);
  expect(state.player.powerState).toBe("small");
});

test("Simulation integration: Brown Paragoomba spawns mini goombas into state.enemies during flight", () => {
  const testLevel: LevelFile = {
    name: "brown-para-test",
    rows: [
      "....................",
      "....................",
      "....................",
      "....................",
      "####################",
    ],
    player: { x: 1, y: 3 },
    enemies: [
      { type: "para_goomba", x: 10, y: 3 },
    ],
  };

  const state = createState(loadLevel(testLevel));
  const brown = state.enemies[0] as ParaGoombaBrown;
  expect(brown).toBeInstanceOf(ParaGoombaBrown);

  // Put into flying state and force drop timer
  brown.state = "flying";
  brown.dropTimer = 1;

  expect(state.enemies.length).toBe(1);
  step(state, 0);

  // A new mini goomba enemy has been spawned into state.enemies!
  expect(state.enemies.length).toBe(2);
  const spawned = state.enemies[1];
  expect(spawned).toBeInstanceOf(MiniGoomba);
  expect(spawned.type).toBe("mini_goomba");
});
