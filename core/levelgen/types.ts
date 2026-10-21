import type { LevelFile } from "../world/level.ts";

export type LevelType = "normal" | "castle" | "caves";

export interface Segment extends LevelFile {
  theme?: LevelType;
  tags?: string[];
  difficulty?: number;
}

export interface GeneratedLevel extends LevelFile {
  type: LevelType;
  seed: number;
}
