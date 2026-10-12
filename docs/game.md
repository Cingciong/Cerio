# Game

Mario, procedurally generated, in the browser.

## Size

| | |
|---|---|
| Tile | 16 × 16 px |
| Screen | 256 × 240 px (16 × 15 tiles), upscaled |
| Level height | rows in the file (segments: 15 tiles = 240 px) |
| Average level | ≈ 210 tiles = **≈ 3360 × 240 px** (SMB 1-1 is 3376 px) |
| Segment | 16 × 15 tiles = 256 × 240 px |
| Level length | set per dataset (shorter or longer), e.g. 13 segments = 3328 × 240 px |
| Pipe sub-area | 1–2 segments |

**Map bounds** come only from the map size, no fixed numbers in `core`:
- left / right edge of the map → wall,
- above the map → air, the player can go there (camera follows up),
- below the map → pit (death),
- right edge → level done (until there is a flagpole).

## Procedural generation

Levels are assembled from segments cut out of the original Mario levels.

1. **Import:** original level → split into 16-tile-wide segments → saved as tile grids.
2. **Tag each segment:** theme (overworld, underground, castle), difficulty 1–5, left/right joint.
3. **Joint:** ground height (and gap) at the segment edge. Two segments connect only if joints match.
4. **Assemble (seed):** start segment → random matching segments with rising difficulty → end segment with flagpole.
5. Same seed → same level.

## Level datasets
It may change we are still thinking about this
Levels are made like an ML dataset. The generator is deterministic, so a level = **generator version + parameters + seed**. The dataset stores seeds, not tile grids (except the frozen test set).

**Splits** (disjoint seed ranges)

| Split | Content | Used for |
|---|---|---|
| train | seeds generated on the fly, unlimited | training |
| val | fixed list of seeds (e.g. 50) | choosing settings, stopping training, comparing runs |
| test | 10 levels saved as JSON (frozen) + their seeds | final evaluation and human time, used once at the end |

The test levels are frozen as files, so a later change in the generator does not change the test set.

**Tiers**

`easy`, `medium`, `hard`, each with its own train/val/test. A tier is a set of generator parameters: length in segments, max segment difficulty, enemy density, max gap width, pipes on/off. Bots train from easy to hard (curriculum).

**Metrics per level** (computed by a script from the level)

- length (tiles, segments), number of gaps, widest gap
- enemies (count, per 100 tiles), highest step, pipes, power-ups
- difficulty score: mean segment difficulty (+ the above)
- added later: human time, bot completion rate, bot time

**Manifest** `levels/<tier>/manifest.json`

```json
{
  "tier": "easy", "generator": 1,
  "params": { "segments": 8, "maxDifficulty": 2, "enemyDensity": 0.5 },
  "train": { "seedFrom": 0 },
  "val":   { "seeds": [1000000, 1000001] },
  "test":  [{ "file": "test/01.json", "seed": 2000000, "metrics": { "length": 128, "gaps": 2 } }]
}
```

## Pipes

A pipe link always has a **start** (enterable pipe, press down) and an **end** (where the player comes out). The player never comes out of a random pipe.

**Data**

- Level JSON has several areas: `main` and sub-areas (`room1`, …), each with its own `rows`.
- `pipes`: `{ id, area, x, y, to }`, where `to` is the id of the target pipe or spawn point.
- A pipe without `to` is a normal solid pipe (cannot be entered).

**Segment tags**

| Tag | Content |
|---|---|
| `plain` | no pipe, or only normal pipes |
| `pipeIn` | main area, pipe that can be entered |
| `pipeOut` | main area, pipe where the player comes out |
| `room` | sub-area: spawn point + exit pipe |

**Generator**

1. Put a `pipeIn` segment at position *i*.
2. Put a `pipeOut` segment at position *j > i* (1–3 segments later, so the room is a shortcut, as in SMB).
3. Pick a `room`. Link: `pipeIn → room spawn`, `room exit → pipeOut`.
4. If no `pipeOut` fits, remove `to` from the `pipeIn` pipe: it becomes a normal pipe. So pipe segments can always be used as `plain`.

**Simpler variant (start here)**

The exit is the same pipe as the entry: the room's exit pipe returns the player on top of the `pipeIn` pipe. Then the generator does not need `pipeOut` segments, only `pipeIn` + `room`. The `pipeOut` variant is added later.

**State**

`State` stores the current area. Entering a pipe switches the area and moves the player to the target. Enemies of an inactive area are paused.

## Power-ups (all required)

From Super Mario Bros. 1–3:

| Power-up | Effect |
|---|---|
| Super Mushroom | small → big, survives one hit, breaks bricks |
| Fire Flower | fireballs |
| Super Star | temporary invincibility, kills on touch |
| Stopwatch | freezes enemies for a moment |
| Super Leaf | raccoon: tail attack, flight (no P-meter, simplified) |
| Tanooki Suit | as leaf (no statue) |
| Frog Suit | higher jump (no swimming levels) |
| Hammer Suit | throws hammers, blocks some projectiles |

Not included: 1-Up, Heart, Bomb, Magic Potion, Magic Whistle, Goomba's Shoe, P-Wing.

Not in the game: P-meter, Tanooki statue, level timer, swimming levels (no water).

Needed by the above: enemies that react to fire, hammers, star and tail.

## Core mechanics

- left, right, jump (variable height), run, crouch/down (pipes), attack (fire, hammer, tail)
- stomp enemies, question blocks, bricks, coins
- enemy types: not final, still being decided
- pits, flagpole (no level timer)
