// Optional link to the Python server. The game runs without it.

import type { GameFrame, ServerReply } from "../core/index.ts";

const URL = "ws://127.0.0.1:8000/ws";

let socket: WebSocket | null = null;
let lastReply: ServerReply | null = null;

function connect(): void {
  socket = new WebSocket(URL);
  socket.onmessage = (e) => (lastReply = JSON.parse(e.data) as ServerReply);
  socket.onclose = () => {
    socket = null;
    setTimeout(connect, 2000); // retry
  };
}
connect();

export function connected(): boolean {
  return socket?.readyState === WebSocket.OPEN;
}

export function sendFrame(frame: GameFrame): void {
  if (connected()) socket!.send(JSON.stringify(frame));
}

export function latestReply(): ServerReply | null {
  return lastReply;
}
