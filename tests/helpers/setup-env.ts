import { inject } from "vitest";

// Runs inside each worker before that worker's test file is evaluated, so
// DATABASE_URL is guaranteed to be set before any test file's static
// `import { db } from "@/lib/db"` (or anything that transitively imports
// it, e.g. "@/lib/session") first runs — that import reads DATABASE_URL at
// module-evaluation time. The actual URL comes from tests/helpers/global-setup.ts.
process.env.DATABASE_URL = inject("TEST_DATABASE_URL");
