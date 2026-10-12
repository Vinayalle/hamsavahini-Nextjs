import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Run via `npm test` (scripts/test.mjs): it provisions the throw-away PostgreSQL and propagates the exit code.
export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      // `server-only` throws outside the Next.js server bundle; in tests we ARE the server.
      "server-only": r("./src/server/__tests__/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/server/__tests__/setup-guard.ts", "./src/server/__tests__/setup-env.ts"],
    // Tests share one database; run files serially for determinism.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
