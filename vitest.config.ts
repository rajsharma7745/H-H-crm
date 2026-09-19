import { defineConfig } from "vitest/config";
import path from "node:path";

// Phase 1 test suite runs against real server-only code (RBAC, session,
// server actions) in a plain Node environment, not a browser — no jsdom
// needed since nothing here renders React.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    setupFiles: ["tests/helpers/setup-env.ts"],
    // All integration test files share the one ephemeral database started
    // in global-setup.ts (see its comment for why). Running files in
    // parallel would let one file's afterEach truncate another file's
    // in-flight data, so file-level parallelism is disabled.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" has no real package in node_modules — Next's bundler
      // special-cases the string internally, but plain Node/Vitest can't
      // resolve it. Every server-only file in src/lib imports it, so
      // tests alias it to a no-op stub (this is also what the package's
      // own non-browser export condition does).
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
    },
  },
});
