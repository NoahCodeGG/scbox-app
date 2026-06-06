/// <reference types="vitest" />
import path from "node:path";
import { defineConfig } from "vitest/config";

// Default env is node: pure scheduling/lib logic stays DOM-free. Hook tests
// opt into jsdom per-file via a `// @vitest-environment jsdom` docblock.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // Only the hook layer is gated for now; App/components are still untested
      // and a global threshold would fail the run.
      include: ["src/hooks/**"],
      thresholds: {
        "src/hooks/**": {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 80,
        },
      },
    },
  },
});
