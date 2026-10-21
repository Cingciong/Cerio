
// TODO Marysia: pliki do client/sounds/, efekty w playSounds, muzyka w updateMusic.

import type { GameEvent } from "../core/index.ts";

export function playSounds(events: GameEvent[]): void {
  for (const e of events) {
    switch (e.type) {
      case "blockBump": // TODO: dźwięk podbicia bloku
        break;
      case "blockBreak": // TODO: dźwięk rozbicia bricka
        break;
    }
  }
}
