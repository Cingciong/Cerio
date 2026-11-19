"""Game server. Receives GameFrame, answers ServerReply.

Run: python -m uvicorn main:app --port 8000   (from server/)

  GET  /health   -> {"ok": true}
  WS   /ws       <- GameFrame (JSON) every frame
                 -> ServerReply (JSON)
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from frame import GameFrame, ServerReply
from rl import RLTrainer
from rl_enemy_train import EnemyServerTrainer

app = FastAPI()

ENEMY_RL_ENABLED = True


@app.get("/health")
def health() -> dict:
    return {"ok": True}


def decide(frame: GameFrame) -> ServerReply:
    """Place for the neural networks. For now: no control (keyboard + default enemies)."""
    return ServerReply(frame=frame.frame)


@app.websocket("/ws")
async def ws(socket: WebSocket) -> None:
    await socket.accept()
    print("client connected", flush=True)

    enemy_trainer = (
        EnemyServerTrainer(num_actions=5, weights_path="enemy_q_weights.pth", load_if_exists=True)
        if ENEMY_RL_ENABLED
        else None
    )
    try:
        while True:
            frame = GameFrame.from_dict(await socket.receive_json())
            enemy_buttons = enemy_trainer.step(frame)
            reply = ServerReply(frame=frame.frame, player=None, enemies=enemy_buttons)
            await socket.send_json(reply.to_dict())
    except WebSocketDisconnect:
        enemy_trainer.save()
        print("client disconnected", flush=True)
