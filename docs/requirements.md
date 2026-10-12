# Requirements (game only)

## Stack

| | Requirement |
|---|---|
| Language | TypeScript ≥ 5.6, `strict: true` |
| Runtime (headless, tools) | Node.js ≥ 22 LTS |
| Bundler / dev server | Vite ≥ 6 |
| Render | HTML5 Canvas 2D, no game engine |
| Tests | Vitest |
| Package manager | npm |
| Runtime dependencies in `core/` | none |
| Browsers | current Chrome, Firefox, Edge |

(Python, PyTorch and the server are out of scope for now.)

## Hard rules for `core/`

- no DOM, no Node API, no `Math.random`, no `Date`
- fixed step 60 Hz, one `step` = one frame
- integer math only (1 px = 16 subpixel units)
- `State` is plain data: JSON-serializable, copyable
- same seed + same buttons → bit-identical state (test)
- headless speed: our internal target ≥ 10 000 frames/s on one thread (not an agreed requirement)
- client: 60 FPS, 256 × 240 internal resolution, upscaled
- tile 16 × 16 px; map size comes from the level file (bounds: map edges left/right only)

## Objects

**Player**
- Mario: position, velocity, facing, form (small, big, fire, raccoon, tanooki, frog, hammer), star (duration), flight, invulnerability after a hit, area

**Tiles**
- empty, ground, hard block, brick, question block (content), used block
- pipe (plain, enterable, exit), flagpole, coin

**Enemies** (not final, still being decided; as needed by the imported segments)
- Goomba, Koopa Troopa (green, red) + shell, Buzzy Beetle, Spiny
- Piranha Plant, Bullet Bill, Hammer Bro

**Projectiles**
- fireball, thrown hammer, enemy hammer, kicked shell

**Items**
- Super Mushroom, Fire Flower, Super Star, Stopwatch
- Super Leaf, Tanooki Suit, Frog Suit, Hammer Suit
- coin

**Level structure**
- Segment (16 × 15 tiles, theme, difficulty, left/right joint)
- Area (main level or pipe sub-area)
- Level (seed → ordered segments, areas, pipe links)
- Dataset (tier, train/val/test seeds, metrics per level; see game.md)

**Game**
- score, coins, lives, camera (client + core scroll position), game states: playing, dead, won

**Client only (not in `State`)**
- sprites, animations, brick debris, score pop-ups, sound, HUD

## Tasks (in order)

Checked = done. Unchecked with a "done:" note = partly done.

- [ ] 1. **Setup** — repo, `core/` + `client/`, Vite, Vitest, strict TS, lint
   - done: everything except lint; missing: lint (ESLint)
- [ ] 2. **Core skeleton** — `State`, `step`, buttons bitmask, seeded RNG, determinism test
   - done: `State`, `step`, buttons, determinism test; missing: seeded RNG (nothing random in the game yet)
- [x] 3. **Movement** — walk/run acceleration, friction, gravity, variable jump, tile collisions (X then Y)
- [ ] 4. **Level format + loader** — JSON tile grid, `loadLevel`, 2–3 handmade test levels
   - done: JSON format, loader, constants in `shared/game.json`; missing: only 1 handmade level so far
- [x] 5. **Client** — game loop, keyboard input, Canvas renderer (placeholder rectangles), scrolling camera
- [ ] 6. **Replay** — record seed + buttons, replay in client and in Node, test
- [ ] 7. **Blocks and coins** — bricks, question blocks, hard blocks, coins, items popping out
- [ ] 8. **Basic enemies** — Goomba, Koopa + shell, stomp, damage, death, restart, flagpole, win
   - done: Goomba (enemy class), stomp, death, restart, win at the right map edge; missing: Koopa + shell, damage (needs power-ups), flagpole
- [ ] 9. **SMB1 power-ups** — form state machine, Super Mushroom, Fire Flower + fireball, Super Star
- [ ] 10. **Pipes** — enter/exit, sub-areas, area switching
- [ ] 11. **SMB3 power-ups** — Super Leaf, Tanooki (tail, flight), Frog Suit, Hammer Suit, Stopwatch
- [ ] 12. **Remaining enemies** (list not final) — Buzzy Beetle, Spiny, Piranha Plant, Bullet Bill, Hammer Bro
- [ ] 13. **Segment import tool** — original levels → 16-tile segments, tags, joints
- [ ] 14. **Generator** — seed → level from segments, joint matching, pipe sub-areas, solvability check by hand-picked rules
- [ ] 15. **Datasets** — tiers, train/val/test seeds, frozen test levels, level metrics script
- [ ] 16. **Graphics and sound** — original sprites, animations, HUD
- [ ] 17. **Performance** — 60 FPS in browser; headless speed (internal target)
