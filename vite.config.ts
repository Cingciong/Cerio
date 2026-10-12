/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url)); // independent of the working directory

export default defineConfig({
  root: here("./client"),
  server: { port: 5173 },
  test: { root: here("."), include: ["tests/**/*.test.ts"] },
});
