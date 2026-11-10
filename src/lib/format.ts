/**
 * Display formatting shared across the app.
 *
 * These were previously four near-identical private `formatDateTime` helpers
 * in four page files, which is how the dashboard ended up showing a different
 * date style to the lead detail page for the same value.
 *
 * Everything here is pure and takes an explicit `now` where it needs one, so
 * a server component can format a relative date without the server's clock
 * and the browser's clock ever disagreeing across hydration.
 */

import { utcToZonedInput } from "@/lib/timezone";

/**
 * `timeZone` is the viewer's IANA zone. Server components must pass it (from
 * getViewerTimeZone) — without it the runtime's own zone is used, which on a
 * server is not the viewer's.
 */
export function formatDateTime(value: Date | string, timeZone?: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone });
}

export function formatDate(value: Date | string, timeZone?: string): string {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone });
}

/** For optional fields: renders a consistent placeholder instead of a blank. */
export function formatDateOrFallback(value: Date | string | null | undefined, fallback = "Not set"): string {
  return value ? formatDate(value) : fallback;
}

export function formatDateTimeOrFallback(
  value: Date | string | null | undefined,
  timeZone?: string,
  fallback = "Not set",
): string {
  return value ? formatDateTime(value, timeZone) : fallback;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "in 3 days" / "2 hours ago" / "Today". Deliberately coarse — this is a
 * scanning aid that sits next to the exact timestamp, not a replacement for it.
 */
export function formatRelative(value: Date | string, now: Date): string {
  const then = new Date(value).getTime();
  const diff = then - now.getTime();
  const abs = Math.abs(diff);
  const past = diff < 0;

  if (abs < MINUTE) return "Just now";
  if (abs < HOUR) {
    const minutes = Math.round(abs / MINUTE);
    return past ? `${minutes} min ago` : `in ${minutes} min`;
  }
  if (abs < DAY) {
    const hours = Math.round(abs / HOUR);
    return past ? `${hours} ${plural(hours, "hour")} ago` : `in ${hours} ${plural(hours, "hour")}`;
  }

  const days = Math.round(abs / DAY);
  if (days === 1) return past ? "Yesterday" : "Tomorrow";
  if (days < 30) return past ? `${days} days ago` : `in ${days} days`;

  const months = Math.round(days / 30);
  if (months < 12) return past ? `${months} ${plural(months, "month")} ago` : `in ${months} ${plural(months, "month")}`;

  const years = Math.round(days / 365);
  return past ? `${years} ${plural(years, "year")} ago` : `in ${years} ${plural(years, "year")}`;
}

/**
 * When a follow-up is due, worded for its status. Only an open follow-up gets a
 * relative phrase ("in 6 hours" / "6 hours ago"); a completed or cancelled one
 * is history, so "in 6 hours" would be misleading — it gets its actual date and time.
 */
export function formatFollowUpWhen(
  followUp: { status: string; dueAt: Date | string },
  now: Date,
  timeZone?: string,
): string {
  return followUp.status === "PENDING"
    ? formatRelative(followUp.dueAt, now)
    : formatDateTime(followUp.dueAt, timeZone);
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

/** Full name, or a consistent "Unassigned" when nobody is responsible. */
export function repName(
  rep: { firstName: string; lastName: string } | null | undefined,
  fallback = "Unassigned",
): string {
  return rep ? `${rep.firstName} ${rep.lastName}` : fallback;
}

/**
 * Money. Amounts arrive as strings (Prisma Decimal, serialised for the client
 * boundary), so this parses defensively and hands back the original string
 * rather than "NaN" if it is ever something unexpected.
 */
export function formatAmount(value: string | number | null | undefined, fallback = "Not set"): string {
  if (value === null || value === undefined || value === "") return fallback;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Value for an `<input type="datetime-local">`: the wall-clock time of the
 * stored UTC instant in `timeZone` (the browser's zone — see
 * src/lib/timezone.ts). The form submits that zone alongside the value so the
 * server converts it back to the same instant; neither side uses its own
 * machine zone, so opening and re-saving a field can't move the appointment.
 */
export function toDateTimeInputValue(value: Date | string | null | undefined, timeZone: string): string {
  return utcToZonedInput(value, timeZone);
}

/** "Now" as wall-clock time in `timeZone` — the default for a newly logged activity. */
export function nowDateTimeInputValue(timeZone: string): string {
  return utcToZonedInput(new Date(), timeZone);
}

/**
 * Value for an `<input type="date">`.
 *
 * Deliberately UTC-based, unlike the datetime helper above: the server parses a
 * bare `YYYY-MM-DD` as UTC midnight (again, that is `Date.parse`'s rule for the
 * date-only form), so reading it back in UTC is what makes a date field
 * round-trip to the same day it was saved as.
 */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}
