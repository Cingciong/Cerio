/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { flagSegment } from "./headless/tools/flagSegment.ts";

// Paths relative to this file, so it works from any working directory.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here("./client"),
  server: { port: 5173 },
  plugins: [flagSegment()],
  test: { root: here("."), include: ["tests/**/*.test.ts"] },
});
