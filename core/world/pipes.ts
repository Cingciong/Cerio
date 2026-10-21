// Pipes in level rows: "<>" is the lip (opening), "[]" the body.
// A lip with body above it hangs from the ceiling and opens down; otherwise it opens up.

export type PipeOpening = "up" | "down";

/** entry: can be entered, leads to pipe `to`; exit: the player comes out here; plain: solid, nothing happens. */
export type PipeKind = "entry" | "exit" | "plain";

export interface PipeLip {
  x: number; // tile of the left half of the lip
  y: number;
  opens: PipeOpening;
}

export interface PipeLink extends PipeLip {
  area: string;
  kind: PipeKind;
  to?: number; // index in the level's pipes, only for entries
}

export function findLips(rows: string[]): PipeLip[] {
  const lips: PipeLip[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length - 1; x++) {
      if (row[x] === "<" && row[x + 1] === ">") lips.push({ x, y, opens: rows[y - 1]?.[x] === "[" ? "down" : "up" });
    }
  });
  return lips.sort((a, b) => a.x - b.x || a.y - b.y);
}
