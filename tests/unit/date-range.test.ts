import { describe, expect, it } from "vitest";
import { createdAtWhere, dateRangeWhere, parseDateRangeKey, resolveDateRange } from "@/lib/queries/date-range";

// Fixed reference point: 2026-09-29 15:00 local time.
const NOW = new Date(2026, 8, 29, 15, 0, 0, 0);

describe("parseDateRangeKey", () => {
  it("passes through known keys and defaults to 30d otherwise", () => {
    expect(parseDateRangeKey("today")).toBe("today");
    expect(parseDateRangeKey("custom")).toBe("custom");
    expect(parseDateRangeKey(undefined)).toBe("30d");
    expect(parseDateRangeKey("nonsense")).toBe("30d");
  });
});

describe("resolveDateRange", () => {
  it("today spans midnight this morning to midnight tonight", () => {
    const range = resolveDateRange({ range: "today" }, NOW);
    expect(range.from).toEqual(new Date(2026, 8, 29, 0, 0, 0, 0));
    expect(range.until).toEqual(new Date(2026, 8, 30, 0, 0, 0, 0));
  });

  it("7d includes today, so it starts 6 days back", () => {
    const range = resolveDateRange({ range: "7d" }, NOW);
    expect(range.from).toEqual(new Date(2026, 8, 23, 0, 0, 0, 0));
    expect(range.until).toEqual(new Date(2026, 8, 30, 0, 0, 0, 0));
  });

  it("30d includes today, so it starts 29 days back", () => {
    const range = resolveDateRange({ range: "30d" }, NOW);
    expect(range.from).toEqual(new Date(2026, 7, 31, 0, 0, 0, 0));
  });

  it("all time is unbounded at both ends", () => {
    const range = resolveDateRange({ range: "all" }, NOW);
    expect(range.from).toBeNull();
    expect(range.until).toBeNull();
  });

  it("custom includes the whole of the 'to' day", () => {
    const range = resolveDateRange({ range: "custom", from: "2026-09-01", to: "2026-09-10" }, NOW);
    expect(range.from).toEqual(new Date(2026, 8, 1, 0, 0, 0, 0));
    // Exclusive bound is the start of the 11th, so the 10th counts in full.
    expect(range.until).toEqual(new Date(2026, 8, 11, 0, 0, 0, 0));
  });

  it("custom tolerates a half-open range and invalid input", () => {
    expect(resolveDateRange({ range: "custom", from: "2026-09-01" }, NOW).until).toBeNull();
    expect(resolveDateRange({ range: "custom", to: "2026-09-10" }, NOW).from).toBeNull();
    expect(resolveDateRange({ range: "custom", from: "banana" }, NOW).from).toBeNull();
  });

  it("does not mutate the `now` it was given", () => {
    resolveDateRange({ range: "30d" }, NOW);
    expect(NOW).toEqual(new Date(2026, 8, 29, 15, 0, 0, 0));
  });
});

describe("dateRangeWhere / createdAtWhere", () => {
  it("builds a gte/lt filter for a bounded range", () => {
    const range = resolveDateRange({ range: "today" }, NOW);
    expect(dateRangeWhere(range)).toEqual({ gte: range.from, lt: range.until });
    expect(createdAtWhere(range)).toEqual({ createdAt: { gte: range.from, lt: range.until } });
  });

  it("produces no filter at all for an unbounded range, so nothing is excluded", () => {
    const range = resolveDateRange({ range: "all" }, NOW);
    expect(dateRangeWhere(range)).toBeUndefined();
    expect(createdAtWhere(range)).toEqual({});
  });

  it("builds a one-sided filter for a half-open custom range", () => {
    const range = resolveDateRange({ range: "custom", from: "2026-09-01" }, NOW);
    expect(dateRangeWhere(range)).toEqual({ gte: new Date(2026, 8, 1, 0, 0, 0, 0) });
  });
});
