import type { Lead } from "@prisma/client";

/**
 * Prisma's `Decimal` (proposalAmount) is a Decimal.js instance, not a plain
 * value React Server Components can serialize across to a Client Component
 * — every other Lead field (including its Date fields) crosses that
 * boundary fine on its own. Converting it to a string here is the one
 * transform every page that hands a Lead to a client component needs.
 */
export function serializeLead<T extends Pick<Lead, "proposalAmount">>(
  lead: T,
): Omit<T, "proposalAmount"> & { proposalAmount: string | null } {
  return { ...lead, proposalAmount: lead.proposalAmount ? lead.proposalAmount.toString() : null };
}
