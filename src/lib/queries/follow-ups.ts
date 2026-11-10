import type { Prisma, FollowUpPriority, FollowUpStatus } from "@prisma/client";
import { escapeLikeWildcards } from "@/lib/queries/search";
import { dayBoundsInZone } from "@/lib/timezone";

/**
 * Pure filter-building logic for the Follow-ups module — mirrors
 * src/lib/queries/leads.ts. `now` is always passed in rather than read from
 * the clock inside, so the date-bucket logic is deterministically testable.
 *
 * Bucket definitions (these are the definitions the UI states, and the ones
 * the dashboard/report metrics reuse):
 *   today     — PENDING and due at any point during the calendar day (in the
 *               viewer's timezone when one is given, else the runtime's)
 *   upcoming  — PENDING and due after today ends
 *   overdue   — PENDING and its due time has already passed
 *   completed — COMPLETED, regardless of date
 *   all       — no status or date restriction
 *
 * `today` and `overdue` deliberately overlap: a follow-up due at 9am that's
 * still pending at 3pm is both due today and overdue, and should show in
 * both places rather than silently leaving the Today list.
 */

export const FOLLOW_UP_VIEWS = ["today", "upcoming", "overdue", "completed", "all"] as const;
export type FollowUpView = (typeof FOLLOW_UP_VIEWS)[number];

export function parseFollowUpView(view: string | undefined): FollowUpView {
  return FOLLOW_UP_VIEWS.includes(view as FollowUpView) ? (view as FollowUpView) : "today";
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfNextDay(date: Date): Date {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + 1);
  return copy;
}

/** The status/date half of the filter — what makes a follow-up belong to a view. */
export function buildFollowUpViewWhere(view: FollowUpView, now: Date, timeZone?: string): Prisma.FollowUpWhereInput {
  const day = timeZone ? dayBoundsInZone(now, timeZone) : { start: startOfDay(now), end: startOfNextDay(now) };
  switch (view) {
    case "today":
      return { status: "PENDING", dueAt: { gte: day.start, lt: day.end } };
    case "upcoming":
      return { status: "PENDING", dueAt: { gte: day.end } };
    case "overdue":
      return { status: "PENDING", dueAt: { lt: now } };
    case "completed":
      return { status: "COMPLETED" };
    case "all":
      return {};
  }
}

const VALID_STATUSES: readonly FollowUpStatus[] = ["PENDING", "COMPLETED", "CANCELLED"];
const VALID_PRIORITIES: readonly FollowUpPriority[] = ["LOW", "MEDIUM", "HIGH"];

export function parseFollowUpStatusFilter(status: string | undefined): FollowUpStatus | undefined {
  return VALID_STATUSES.includes(status as FollowUpStatus) ? (status as FollowUpStatus) : undefined;
}

export function parseFollowUpPriorityFilter(priority: string | undefined): FollowUpPriority | undefined {
  return VALID_PRIORITIES.includes(priority as FollowUpPriority) ? (priority as FollowUpPriority) : undefined;
}

export function buildFollowUpWhere(params: {
  view?: string;
  priority?: string;
  assignedRep?: string;
  status?: string;
  q?: string;
  now: Date;
  timeZone?: string;
}): Prisma.FollowUpWhereInput {
  const view = parseFollowUpView(params.view);
  const priority = parseFollowUpPriorityFilter(params.priority);
  // The view already pins status for every bucket except "all", so an
  // explicit status filter only applies there (the UI only offers it there).
  const status = view === "all" ? parseFollowUpStatusFilter(params.status) : undefined;
  const q = params.q ? escapeLikeWildcards(params.q) : params.q;

  return {
    ...buildFollowUpViewWhere(view, params.now, params.timeZone),
    ...(priority ? { priority } : {}),
    ...(status ? { status } : {}),
    ...(params.assignedRep ? { assignedRepId: params.assignedRep } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { lead: { name: { contains: q, mode: "insensitive" } } },
            { lead: { companyName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}
