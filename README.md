# H&H CRM

Agency operating system for H&H — replaces the spreadsheets (clients, leads, tasks, time, files, credentials) with one secure app. See the phased blueprint for full scope; this repo currently implements **Phase 1: Application Foundation, Authentication & Permissions** only.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui (Base UI primitives) · PostgreSQL + Prisma 7 (driver-adapter model) · database-backed sessions (not JWT) · centralized RBAC.

## Getting started

```bash
npm install
cp .env.example .env
```

You need a Postgres database. Pick one:

**Option A — local dev database, zero setup (recommended for local dev):**
Prisma 7 ships a built-in local Postgres (`prisma dev`, backed by an embedded engine) — no Docker, no account, no install.

```bash
npm run db:dev             # starts it in the background, prints a connection URL
```

Copy the printed TCP connection string (looks like `postgres://postgres:postgres@localhost:<port>/template1?sslmode=disable`) into `DATABASE_URL` in `.env`. It persists between restarts; `npx prisma dev ls` shows running servers, `npx prisma dev stop` stops one.

**Option B — real Postgres via Docker:**
```bash
docker compose up -d db    # matches the DATABASE_URL already in .env.example
```

**Option C — hosted Postgres** (Neon, Supabase, Railway, etc.) — paste its connection string into `DATABASE_URL`.

Then, whichever option you picked:

```bash
npm run db:migrate:deploy  # apply migrations
npm run db:seed            # seed roles, permissions, and the initial Super Admin
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with the Super Admin credentials from `.env` (`SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`) — **change that password immediately after first login.**

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build / run |
| `npm run db:migrate` | Create a new migration from schema changes (dev) |
| `npm run db:migrate:deploy` | Apply existing migrations (no schema diffing) |
| `npm run db:seed` | Re-run the roles/permissions/admin seed |
| `npm run db:studio` | Open Prisma Studio against the current `DATABASE_URL` |

## Notes

- Password reset emails aren't wired to a real provider yet — in development they're printed to the server console (`sendMail` dev stub in `src/lib/mailer.ts`). Wire a real provider there before relying on this in production.
- Route protection: `src/proxy.ts` (Next 16's middleware convention) does a coarse cookie-presence redirect for UX only. The actual authorization boundary is `requireAuth`/`requireRole`/`requirePermission` in `src/lib/rbac/authorize.ts`, enforced server-side on every protected layout, page, and server action.
- Permission architecture (`src/lib/rbac/permissions.ts`) already defines keys for modules that don't exist yet (clients, leads, tasks, time, files, credentials, reports) — later phases add their logic against permissions that are already seeded, without touching the auth system.
