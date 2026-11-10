import type { Prisma } from "@prisma/client";

/**
 * Shared date-range parsing for the dashboard and reports.
 *
 * `now` is always passed in rather than read from the clock inside, so every
 * metric in one render agrees on the same instant and the logic stays
 * deterministically testable.
 *
 * Ranges are inclusive of both ends and snap to local day boundaries:
 *   today — midnight this morning through the end of today
 *   7d    — the last 7 days including today
 *   30d   — the last 30 days including today
 *   all   — no date restriction
 *   custom — `from`/`to` (either may be omitted for an open-ended range)
 */

export const DATE_RANGE_KEYS = ["today", "7d", "30d", "all", "custom"] as const;
export type DateRangeKey = (typeof DATE_RANGE_KEYS)[number];

export type ResolvedDateRange = {
  key: DateRangeKey;
  label: string;
  /** Inclusive start, or null for open-ended. */
  from: Date | null;
  /** Exclusive end (start of the day after the range's last day). */
  until: Date | null;
};

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfNextDay(date: Date): Date {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + 1);
  return copy;
}

function daysAgo(date: Date, days: number): Date {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

export function parseDateRangeKey(range: string | undefined): DateRangeKey {
  return DATE_RANGE_KEYS.includes(range as DateRangeKey) ? (range as DateRangeKey) : "30d";
}

/** Parses a `YYYY-MM-DD` input value, returning null for missing/invalid input. */
function parseDayInput(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return startOfDay(new Date(parsed));
}

export function resolveDateRange(
  params: { range?: string; from?: string; to?: string },
  now: Date,
): ResolvedDateRange {
  const key = parseDateRangeKey(params.range);

  switch (key) {
    case "today":
      return { key, label: "Today", from: startOfDay(now), until: startOfNextDay(now) };
    case "7d":
      // Includes today, so the window starts 6 days back.
      return { key, label: "Last 7 days", from: daysAgo(now, 6), until: startOfNextDay(now) };
    case "30d":
      return { key, label: "Last 30 days", from: daysAgo(now, 29), until: startOfNextDay(now) };
    case "all":
      return { key, label: "All time", from: null, until: null };
    case "custom": {
      const from = parseDayInput(params.from);
      const to = parseDayInput(params.to);
      return {
        key,
        label: "Custom range",
        from,
        // `to` names a day that should be included, so the exclusive bound is
        // the start of the following day.
        until: to ? startOfNextDay(to) : null,
      };
    }
  }
}

/** Turns a resolved range into a Prisma filter for the given timestamp field. */
export function dateRangeWhere(range: ResolvedDateRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.until) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.until ? { lt: range.until } : {}),
  };
}

/** Convenience: `{ createdAt: {...} }`, or `{}` when the range is unbounded. */
export function createdAtWhere(range: ResolvedDateRange): { createdAt?: Prisma.DateTimeFilter } {
  const filter = dateRangeWhere(range);
  return filter ? { createdAt: filter } : {};
}
