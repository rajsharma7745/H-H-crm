import type { TestProject } from "vitest/node";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import path from "node:path";

declare module "vitest" {
  export interface ProvidedContext {
    TEST_DATABASE_URL: string;
  }
}

/**
 * Runs once for the whole test run (not per test file). Starts a single
 * in-memory Postgres (via the project's own @electric-sql/pglite /
 * pglite-socket devDependencies — the same embedded-Postgres tech behind
 * `prisma dev`) and exposes it over a real TCP socket so the app's
 * unmodified PrismaPg adapter can connect via a normal DATABASE_URL.
 *
 * A single shared instance (rather than one per file) is deliberate: PGlite
 * is a WASM Postgres build and allocating its linear memory repeatedly in
 * quick succession is unreliable in this environment. See
 * vitest.config.ts's `fileParallelism: false` — required so test files
 * (which share this one database) never truncate each other's data mid-run.
 */
export default async function setup(project: TestProject) {
  const pglite = new PGlite();
  await pglite.waitReady;

  const socketServer = new PGLiteSocketServer({
    db: pglite,
    port: 0, // OS-assigned free port
    host: "127.0.0.1",
    maxConnections: 10,
  });
  await socketServer.start();

  const databaseUrl = `postgres://postgres:postgres@${socketServer.getServerConn()}/postgres?sslmode=disable`;
  project.provide("TEST_DATABASE_URL", databaseUrl);

  // Apply every migration in order (not just the initial one) so the
  // ephemeral test database's schema always matches prisma/schema.prisma.
  const migrationsDir = path.resolve(__dirname, "../../prisma/migrations");
  const migrationFolders = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const folder of migrationFolders) {
    const migrationSql = fs.readFileSync(path.join(migrationsDir, folder, "migration.sql"), "utf8");
    await pglite.exec(migrationSql);
  }

  return async () => {
    await socketServer.stop();
    await pglite.close();
  };
}
