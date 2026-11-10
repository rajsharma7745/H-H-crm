/** Prisma's `contains` compiles to a Postgres ILIKE, which treats `%`/`_` as
 * wildcards — escape them (Postgres's default LIKE escape char is `\`) so a
 * literal search term like "50%_off" matches literally instead of behaving
 * as a wildcard pattern. Shared by every module's search filter (clients,
 * leads, ...). */
export function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
