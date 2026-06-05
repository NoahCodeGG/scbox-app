/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

// Pure scheduling logic only needs the node environment (no DOM).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
