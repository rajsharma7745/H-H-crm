import { afterEach, describe, expect, it } from "vitest";
import {
  dayBoundsInZone,
  isValidTimeZone,
  resolveTimeZone,
  utcToZonedInput,
  zonedToUtc,
} from "@/lib/timezone";
import { formatAmount, formatFollowUpWhen, toDateTimeInputValue } from "@/lib/format";

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

// 14:30 on 5 Oct 2026 in India (UTC+05:30, no DST) is 09:00 UTC.
const INDIA_WALL_CLOCK = "2026-10-05T14:30";
const INDIA_INSTANT = "2026-10-05T09:00:00.000Z";

describe("Scenario A — India", () => {
  it("14:30 Asia/Kolkata is stored as 09:00 UTC", () => {
    expect(zonedToUtc(INDIA_WALL_CLOCK, "Asia/Kolkata")?.toISOString()).toBe(INDIA_INSTANT);
  });

  it("shows 14:30 again when edited in the same timezone, and saving returns the same instant", () => {
    const shown = utcToZonedInput(INDIA_INSTANT, "Asia/Kolkata");
    expect(shown).toBe(INDIA_WALL_CLOCK);
    expect(zonedToUtc(shown, "Asia/Kolkata")?.toISOString()).toBe(INDIA_INSTANT);
  });
});

describe("Scenario B — New York browser, appointment made in India", () => {
  it("shows the same instant as New York local time (05:00 EDT)", () => {
    expect(utcToZonedInput(INDIA_INSTANT, "America/New_York")).toBe("2026-10-05T05:00");
  });

  it("saving the displayed value without changing it does not move the appointment", () => {
    const shown = toDateTimeInputValue(INDIA_INSTANT, "America/New_York");
    expect(zonedToUtc(shown, "America/New_York")?.toISOString()).toBe(INDIA_INSTANT);
  });

  it("the previous failure mode is really gone: 05:00 is not read back as India time", () => {
    // This is what the old code effectively did (server zone applied to a
    // value that was in the browser zone) — it lands 9.5 hours earlier.
    expect(zonedToUtc("2026-10-05T05:00", "Asia/Kolkata")?.toISOString()).not.toBe(INDIA_INSTANT);
  });
});

describe("Scenario C — independent of the server's timezone", () => {
  it.each(["UTC", "Asia/Kolkata", "America/New_York", "Pacific/Auckland", "Europe/London"])(
    "gives identical results with the process running in %s",
    (serverZone) => {
      process.env.TZ = serverZone;
      expect(zonedToUtc(INDIA_WALL_CLOCK, "Asia/Kolkata")?.toISOString()).toBe(INDIA_INSTANT);
      expect(utcToZonedInput(INDIA_INSTANT, "Asia/Kolkata")).toBe(INDIA_WALL_CLOCK);
      expect(utcToZonedInput(INDIA_INSTANT, "America/New_York")).toBe("2026-10-05T05:00");
      expect(zonedToUtc("2026-10-05T05:00", "America/New_York")?.toISOString()).toBe(INDIA_INSTANT);
    },
  );
});

describe("daylight saving", () => {
  it("resolves the correct offset either side of a transition", () => {
    // New York: EDT (UTC-4) until 1 Nov 2026 02:00, then EST (UTC-5).
    expect(zonedToUtc("2026-10-31T12:00", "America/New_York")?.toISOString()).toBe("2026-10-31T16:00:00.000Z");
    expect(zonedToUtc("2026-11-02T12:00", "America/New_York")?.toISOString()).toBe("2026-11-02T17:00:00.000Z");
  });

  it("round-trips a time on the day of the change", () => {
    const utc = zonedToUtc("2026-11-01T12:00", "America/New_York")!;
    expect(utcToZonedInput(utc, "America/New_York")).toBe("2026-11-01T12:00");
  });
});

describe("input handling", () => {
  it("passes strings that already carry an offset through unchanged", () => {
    expect(zonedToUtc("2026-10-05T09:00:00Z", "America/New_York")?.toISOString()).toBe(INDIA_INSTANT);
    expect(zonedToUtc("2026-10-05T14:30:00+05:30", "America/New_York")?.toISOString()).toBe(INDIA_INSTANT);
  });

  it("falls back to UTC — not the server zone — for a missing or invalid timezone", () => {
    process.env.TZ = "Asia/Kolkata";
    expect(zonedToUtc("2026-10-05T10:00", null)?.toISOString()).toBe("2026-10-05T10:00:00.000Z");
    expect(zonedToUtc("2026-10-05T10:00", "Not/AZone")?.toISOString()).toBe("2026-10-05T10:00:00.000Z");
    expect(resolveTimeZone("nonsense")).toBe("UTC");
  });

  it("validates IANA identifiers", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("x".repeat(100))).toBe(false);
  });

  it("returns null for garbage and empty string for empty values", () => {
    expect(zonedToUtc("not-a-date", "UTC")).toBeNull();
    expect(utcToZonedInput(null, "UTC")).toBe("");
    expect(utcToZonedInput("garbage", "UTC")).toBe("");
  });
});

describe("dayBoundsInZone", () => {
  it("uses the viewer's calendar day, not the server's", () => {
    process.env.TZ = "UTC";
    // 02:00 UTC on 6 Oct is still 5 Oct evening in New York, and 07:30 on 6 Oct in India.
    const now = new Date("2026-10-06T02:00:00Z");
    const ny = dayBoundsInZone(now, "America/New_York");
    expect(ny.start.toISOString()).toBe("2026-10-05T04:00:00.000Z");
    expect(ny.end.toISOString()).toBe("2026-10-06T04:00:00.000Z");
    const india = dayBoundsInZone(now, "Asia/Kolkata");
    expect(india.start.toISOString()).toBe("2026-10-05T18:30:00.000Z");
    expect(india.end.toISOString()).toBe("2026-10-06T18:30:00.000Z");
  });
});

describe("formatFollowUpWhen", () => {
  const now = new Date("2026-10-05T03:00:00Z");
  const future = new Date("2026-10-05T09:00:00Z"); // 6 hours ahead

  it("open follow-ups get relative wording", () => {
    expect(formatFollowUpWhen({ status: "PENDING", dueAt: future }, now, "UTC")).toBe("in 6 hours");
    expect(formatFollowUpWhen({ status: "PENDING", dueAt: new Date("2026-10-04T21:00:00Z") }, now, "UTC")).toBe(
      "6 hours ago",
    );
  });

  it.each(["COMPLETED", "CANCELLED"])("%s follow-ups show the actual date and time, never 'in 6 hours'", (status) => {
    const text = formatFollowUpWhen({ status, dueAt: future }, now, "Asia/Kolkata");
    expect(text).not.toMatch(/in 6 hours|ago/);
    expect(text).toContain("2:30");
  });
});

describe("formatAmount", () => {
  it("always shows two decimals without changing the value", () => {
    expect(formatAmount("2500.5", "x")).toMatch(/2.500[.,]50$/);
    expect(formatAmount(2500.5)).toMatch(/2.500[.,]50$/);
    expect(formatAmount("2500")).toMatch(/2.500[.,]00$/);
    expect(formatAmount(null)).toBe("Not set");
  });
});
