/**
 * Timezone handling for wall-clock date/time inputs.
 *
 * Model: the database stores UTC instants. A `<input type="datetime-local">`
 * only ever deals in a wall-clock string ("2026-10-05T14:30") with no zone, so
 * that string is only meaningful together with a timezone. The browser sends
 * its IANA zone (e.g. "Asia/Kolkata") alongside the field, and these helpers
 * convert between the two — using the given zone, never the machine's. That is
 * what keeps a 14:30 India appointment 14:30 in India whatever zone the server
 * or another user's browser happens to be in.
 *
 * Pure and dependency-free (Intl only), so it runs identically on the server,
 * in the browser and under test.
 */

export const TIME_ZONE_COOKIE = "hh_tz";
export const TIME_ZONE_FIELD = "timeZone";

/** Used only when no zone was supplied at all — never the server's local zone. */
export const FALLBACK_TIME_ZONE = "UTC";

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(value: unknown): string {
  return isValidTimeZone(value) ? value : FALLBACK_TIME_ZONE;
}

/** The browser's IANA zone. Only meaningful in a client component. */
export function browserTimeZone(): string {
  try {
    return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(instant: number, timeZone: string): Parts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(formatted.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of `timeZone` from UTC at `instant`, in ms (positive east of UTC). */
function offsetAt(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Converts a zone-less wall-clock string to the UTC instant it denotes in
 * `timeZone`. A string that already carries an offset or "Z", or a date-only
 * string, is not wall-clock input and is parsed as-is. Returns null if invalid.
 */
export function zonedToUtc(value: string, timeZone: unknown): Date | null {
  const text = value.trim();
  const match = LOCAL_PATTERN.exec(text);
  if (!match) {
    const direct = new Date(text);
    return Number.isNaN(direct.getTime()) ? null : direct;
  }

  const zone = resolveTimeZone(timeZone);
  const [, y, mo, d, h, mi, s] = match;
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);

  // Two passes: the offset at the naive guess can differ from the offset at
  // the real instant when a DST transition lies between them.
  let instant = naive - offsetAt(naive, zone);
  instant = naive - offsetAt(instant, zone);

  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** Wall-clock `YYYY-MM-DDTHH:mm` of a UTC instant in `timeZone`, for a datetime-local input. */
export function utcToZonedInput(value: Date | string | null | undefined, timeZone: unknown): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const p = zonedParts(date.getTime(), resolveTimeZone(timeZone));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** UTC instants of the start of the local calendar day containing `now`, and of the next day. */
export function dayBoundsInZone(now: Date, timeZone: unknown): { start: Date; end: Date } {
  const zone = resolveTimeZone(timeZone);
  const p = zonedParts(now.getTime(), zone);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startLocal = `${p.year}-${pad(p.month)}-${pad(p.day)}T00:00`;
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const endLocal = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T00:00`;
  return { start: zonedToUtc(startLocal, zone)!, end: zonedToUtc(endLocal, zone)! };
}
