# Cerio

A 2D platformer that is simply Mario, running in the browser, with a bot that autonomously completes procedurally generated levels. The bot is trained in two ways, neuroevolution and reinforcement learning, and the two are compared.

## Project goals

- Game: Mario clone in the browser (run, jump, enemies, blocks, mushrooms, coins, flagpole). All power-ups from SMB 1–3 (except 1-Up, Heart, Bomb, Magic Potion, Magic Whistle, Goomba's Shoe). Levels are assembled from segments of the original Mario levels.
- Bot: reads game metadata (no rendering); neural network on the server, trained with neuroevolution and with RL.
- Criteria: ≥ 70% of the 10 test levels completed, in less than 3× human completion time, for both approaches.

## Stack

- Client: TypeScript, HTML5 Canvas (no Pygame). The game works without the server.
- Headless game core for training: Node.js, the same deterministic code as in the client.
- Server: Python, PyTorch, WebSocket.

## Run

```
npm install
npm run dev          # game: http://localhost:5173
npm run headless     # game in Node, no graphics, speed test
npm test             # determinism test

python -m venv server/.venv
server/.venv/Scripts/pip install -r server/requirements.txt
server/.venv/Scripts/python -m uvicorn main:app --port 8000 --app-dir server   # optional
```

## Code

| Folder | Content |
|---|---|
| `shared/game.json` | all constants: units, buttons, tiles, physics, enemies, rules, view (read by TS and Python) |
| `core/` | game: tiles, level loader, physics (`body.ts`), `player.ts`, `enemy.ts`, `step.ts`, server message (`frame.ts`) |
| `levels/` | levels as JSON |
| `client/` | browser: game loop, keyboard, hitbox renderer, WebSocket |
| `headless/` | the same game in Node without graphics |
| `server/` | Python: WebSocket `/ws`, message structs (`frame.py`), `game_config.py` (adapter for `shared/game.json`) |
| `tests/` | Vitest |

## Files

| File | Description |
|---|---|
| `docs/architecture.md` | Modules, stack, communication graph |
| `docs/game.md` | Game: sizes, level generation, pipes, power-ups |
| `docs/requirements.md` | Hard requirements, game objects, task list |
| `docs/report/documentation.tex` | Project documentation (LaTeX, PDF version alongside) |
| `docs/report/gantt.py` | Generates the schedule (`gantt-chart.png`, `gantt-chart.xlsx`) |
| `docs/presentations/` | Checkpoint presentations |
