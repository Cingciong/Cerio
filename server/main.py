"""Game server. Receives GameFrame, answers ServerReply.

Run: python -m uvicorn main:app --port 8000   (from server/)

  GET  /health   -> {"ok": true}
  WS   /ws       <- GameFrame (JSON) every frame
                 -> ServerReply (JSON)
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from frame import GameFrame, ServerReply

app = FastAPI()


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
    try:
        while True:
            frame = GameFrame.from_dict(await socket.receive_json())
            if frame.frame % 60 == 0:
                p = frame.player
                alive = sum(e.alive for e in frame.enemies)
                print(f"frame {frame.frame}: player ({p.x:.1f}, {p.y:.1f}) v=({p.vx:.2f}, {p.vy:.2f}) {p.pressed}, enemies alive {alive}", flush=True)
            await socket.send_json(decide(frame).to_dict())
    except WebSocketDisconnect:
        print("client disconnected", flush=True)
