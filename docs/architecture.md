# Architecture

## Stack

| Part | Technology |
|---|---|
| Game core | TypeScript, no dependencies |
| Client | TypeScript, Vite, HTML5 Canvas |
| Headless | Node.js, same core |
| Server | Python, PyTorch, Stable-Baselines3 (Gymnasium), WebSocket |
| Tests | Vitest |

## Modules

```
core/      pure simulation (no DOM), step(state, buttons)
client/    Vite, Canvas, input, game loop, replay
headless/  Node: many environments, neuroevolution, bridge to Python
server/    Python: PyTorch, RL, WebSocket
```

- **core** — the whole game: physics, enemies, power-ups, pipes, level assembly. Deterministic (fixed 60 Hz step, integer math, seeded RNG). Imports nothing from browser or Node.
- **client** — plays the game for a human. Reads keys, calls `step`, draws `State`. Replay (seed + buttons per frame) for debugging. Works without the server.
- **headless** — runs `core` in Node without graphics, as fast as possible. Exposes `Env` (`reset`, `step`) for training.
- **server** — trains and serves the neural network. Not part of the game.

## Communication

```
        function calls                      function calls
 client ───────────────▶  core  ◀───────────────  headless
   │                                                  ▲
   │ WebSocket                                        │ bridge (WebSocket / pipe)
   │ obs ▶ / ◀ action                                 │ batched step / reset
   ▼                                                  ▼
                        server (Python)
```

| Link | How | When |
|---|---|---|
| client → core | function call | always |
| headless → core | function call | always |
| server ↔ headless | bridge, batched `step`/`reset` | training |
| client ↔ server | WebSocket, observation in, action out | live bot |

A human playing needs only `client` + `core`.

## Game core interface

```ts
loadLevel(seed | segments) → State
step(state, buttons) → State      // 1 frame, buttons = bitmask: left, right, jump, run, (down, attack)
observe(state) → number[]
```
