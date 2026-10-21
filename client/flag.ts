import type { GameState } from "../core/index.ts";
import { releaseKeys } from "./input.ts";
import { currentSegment } from "./render.ts";

const dialog = document.getElementById("flag-dialog") as HTMLDialogElement;
const nameEl = document.getElementById("flag-name")!;
const comment = document.getElementById("flag-comment") as HTMLTextAreaElement;
const confirm = document.getElementById("flag-confirm") as HTMLButtonElement;
comment.addEventListener("input", () => (confirm.disabled = comment.value.trim() === ""));


export function flagDialogOpen(): boolean {
  return dialog.open;
}


function ask(name: string): Promise<string | null> {
  nameEl.textContent = name;
  comment.value = "";
  confirm.disabled = true;
  dialog.returnValue = "";
  dialog.showModal();
  comment.focus();
  return new Promise((resolve) =>
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok" ? comment.value.trim() : null), { once: true }),
  );
}


export async function flagCurrentSegment(state: GameState, paths: Record<string, string>): Promise<string> {
  const seg = currentSegment(state);
  const path = seg && paths[seg.name];
  if (!path) return ""; 

  releaseKeys();
  const text = await ask(seg.name);
  releaseKeys();
  if (text === null) return "anulowano";

  const res = await fetch("/debug/flag-segment", {
    method: "POST",
    body: JSON.stringify({ path, comment: text, level: state.level.name }),
  });
  const reply = await res.json();
  return reply.ok ? `${seg.name} -> levels/${reply.to}` : `error: ${reply.error}`;
}
