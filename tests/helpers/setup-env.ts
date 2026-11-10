import { afterAll, inject } from "vitest";

// Runs inside each worker before that worker's test file is evaluated, so
// DATABASE_URL is guaranteed to be set before any test file's static
// `import { db } from "@/lib/db"` (or anything that transitively imports
// it, e.g. "@/lib/session") first runs — that import reads DATABASE_URL at
// module-evaluation time. The actual URL comes from tests/helpers/global-setup.ts.
process.env.DATABASE_URL = inject("TEST_DATABASE_URL");

// Every test file gets its own worker, and therefore its own Prisma client
// and connection pool against the single shared PGlite instance. Nothing used
// to close those pools, so once the suite grew past a handful of integration
// files the server ran out of connections and later files died with
// "Connection terminated unexpectedly". Release this file's pool when it ends.
//
// Reads the client off the global that src/lib/db.ts caches it on (outside
// production) rather than importing it, so a pure unit-test file that never
// touches the database doesn't get a client instantiated just to tear it down.
afterAll(async () => {
  const cached = (globalThis as { prisma?: { $disconnect: () => Promise<void> } }).prisma;
  if (cached) await cached.$disconnect();
});
