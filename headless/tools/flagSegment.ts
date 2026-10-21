

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

const LEVELS = join(import.meta.dirname, "..", "..", "levels");
const ALLOWED = /^(normal|castle|caves)\/[\w-]+\.json$/;

// POST /debug/flag-segment { path: "xyz_level", comment, level }

export function flagSegment(): Plugin {
  return {
    name: "flag-segment",
    configureServer(server) {
      server.middlewares.use("/debug/flag-segment", (req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const { path, comment, level } = JSON.parse(body);
            if (req.method !== "POST" || !ALLOWED.test(path)) throw new Error(`bad request: ${path}`);
            const from = join(LEVELS, path);
            const file = path.split("/")[1];
            const to = join(LEVELS, "to_fix", file);
            mkdirSync(join(LEVELS, "to_fix"), { recursive: true });

            const segment = JSON.parse(readFileSync(from, "utf8"));
            segment.fix = { from: path.split("/")[0], comment: String(comment ?? ""), level, date: new Date().toISOString() };
            writeFileSync(from, JSON.stringify(segment, null, 2) + "\n");
            renameSync(from, to);
            res.end(JSON.stringify({ ok: true, to: `to_fix/${file}` }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}
