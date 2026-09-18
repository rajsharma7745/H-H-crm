import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer reads the connection string from schema.prisma.
// This file is used by the `prisma` CLI (migrate/studio/generate) only —
// the running app connects via the driver adapter in src/lib/db.ts instead.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
