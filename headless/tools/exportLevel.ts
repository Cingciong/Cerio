// Writes a generated level to levels/generated/ for inspection.
// npm run export-level -- [seed] [length] [type]

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LevelGenerator, type LevelType } from "../../core/index.ts";
import { loadLibrary } from "./segmentFiles.ts";

const [seed = "1", length = "200", type = "normal"] = process.argv.slice(2);
const level = new LevelGenerator(loadLibrary()).generate(Number(seed), { length: Number(length), type: type as LevelType });
const dir = join(import.meta.dirname, "..", "..", "levels", "generated");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${level.name}.json`), JSON.stringify(level, null, 2));
console.log(`${level.name}: ${level.rows[0].length} tiles`);
console.log(level.rows.join("\n"));
