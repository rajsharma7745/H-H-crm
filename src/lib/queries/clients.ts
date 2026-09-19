import type { Prisma, ClientStatus } from "@prisma/client";

/**
 * Pure filter-building logic for the client list, split out from the page
 * component so search/status/owner filtering can be unit tested without
 * rendering — mirrors how src/lib/navigation.ts separates pure logic from
 * its components.
 */

const VALID_CLIENT_STATUSES: readonly ClientStatus[] = ["PROSPECT", "ACTIVE", "PAUSED", "CHURNED"];

export function parseClientStatusFilter(status: string | undefined): ClientStatus | undefined {
  return VALID_CLIENT_STATUSES.includes(status as ClientStatus) ? (status as ClientStatus) : undefined;
}

/** Prisma's `contains` compiles to a Postgres ILIKE, which treats `%`/`_` as
 * wildcards — escape them (Postgres's default LIKE escape char is `\`) so a
 * literal search term like "50%_off" matches literally instead of behaving
 * as a wildcard pattern. */
function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function buildClientWhere(params: {
  q?: string;
  status?: string;
  owner?: string;
}): Prisma.ClientWhereInput {
  const status = parseClientStatusFilter(params.status);
  const q = params.q ? escapeLikeWildcards(params.q) : params.q;

  return {
    ...(status ? { status } : {}),
    ...(params.owner ? { ownerId: params.owner } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { primaryContactName: { contains: q, mode: "insensitive" } },
            { primaryContactEmail: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
