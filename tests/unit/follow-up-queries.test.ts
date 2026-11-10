import { describe, expect, it } from "vitest";
import {
  buildFollowUpViewWhere,
  buildFollowUpWhere,
  parseFollowUpPriorityFilter,
  parseFollowUpStatusFilter,
  parseFollowUpView,
  startOfDay,
  startOfNextDay,
} from "@/lib/queries/follow-ups";

// Fixed reference point: 2026-09-29 15:00 local time.
const NOW = new Date(2026, 8, 29, 15, 0, 0, 0);

describe("parseFollowUpView", () => {
  it("passes through every known view", () => {
    for (const view of ["today", "upcoming", "overdue", "completed", "all"]) {
      expect(parseFollowUpView(view)).toBe(view);
    }
  });

  it("defaults to 'today' for missing or unknown views", () => {
    expect(parseFollowUpView(undefined)).toBe("today");
    expect(parseFollowUpView("")).toBe("today");
    expect(parseFollowUpView("nonsense")).toBe("today");
  });
});

describe("day boundaries", () => {
  it("startOfDay zeroes the time without mutating the input", () => {
    const result = startOfDay(NOW);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(29);
    expect(NOW.getHours()).toBe(15);
  });

  it("startOfNextDay is midnight the following day", () => {
    const result = startOfNextDay(NOW);
    expect(result.getDate()).toBe(30);
    expect(result.getHours()).toBe(0);
  });
});

describe("buildFollowUpViewWhere", () => {
  it("today = pending, due anywhere inside the local calendar day", () => {
    expect(buildFollowUpViewWhere("today", NOW)).toEqual({
      status: "PENDING",
      dueAt: { gte: startOfDay(NOW), lt: startOfNextDay(NOW) },
    });
  });

  it("upcoming = pending, due from tomorrow onward", () => {
    expect(buildFollowUpViewWhere("upcoming", NOW)).toEqual({
      status: "PENDING",
      dueAt: { gte: startOfNextDay(NOW) },
    });
  });

  it("overdue = pending, due before right now (so it includes earlier today)", () => {
    expect(buildFollowUpViewWhere("overdue", NOW)).toEqual({ status: "PENDING", dueAt: { lt: NOW } });
  });

  it("completed ignores dates entirely", () => {
    expect(buildFollowUpViewWhere("completed", NOW)).toEqual({ status: "COMPLETED" });
  });

  it("all applies no status or date restriction", () => {
    expect(buildFollowUpViewWhere("all", NOW)).toEqual({});
  });
});

describe("parseFollowUpStatusFilter / parseFollowUpPriorityFilter", () => {
  it("passes through valid values and rejects anything else", () => {
    expect(parseFollowUpStatusFilter("PENDING")).toBe("PENDING");
    expect(parseFollowUpStatusFilter("bogus")).toBeUndefined();
    expect(parseFollowUpPriorityFilter("HIGH")).toBe("HIGH");
    expect(parseFollowUpPriorityFilter("all")).toBeUndefined();
  });
});

describe("buildFollowUpWhere", () => {
  it("defaults to the today bucket", () => {
    expect(buildFollowUpWhere({ now: NOW })).toEqual(buildFollowUpViewWhere("today", NOW));
  });

  it("layers a priority filter on top of the bucket", () => {
    const where = buildFollowUpWhere({ view: "overdue", priority: "HIGH", now: NOW });
    expect(where).toMatchObject({ status: "PENDING", priority: "HIGH" });
  });

  it("layers an assigned-rep filter on top of the bucket", () => {
    const where = buildFollowUpWhere({ view: "upcoming", assignedRep: "user-1", now: NOW });
    expect(where).toMatchObject({ status: "PENDING", assignedRepId: "user-1" });
  });

  it("honors an explicit status filter only on the 'all' view", () => {
    expect(buildFollowUpWhere({ view: "all", status: "CANCELLED", now: NOW })).toMatchObject({
      status: "CANCELLED",
    });
    // On 'today' the bucket's own PENDING wins and the filter is ignored.
    expect(buildFollowUpWhere({ view: "today", status: "CANCELLED", now: NOW })).toMatchObject({
      status: "PENDING",
    });
  });

  it("searches the follow-up title and its lead's name/company", () => {
    const where = buildFollowUpWhere({ view: "all", q: "acme", now: NOW });
    expect(where.OR).toEqual([
      { title: { contains: "acme", mode: "insensitive" } },
      { lead: { name: { contains: "acme", mode: "insensitive" } } },
      { lead: { companyName: { contains: "acme", mode: "insensitive" } } },
    ]);
  });

  it("escapes LIKE wildcards in the search term", () => {
    const where = buildFollowUpWhere({ view: "all", q: "50%_off", now: NOW });
    expect(where.OR?.[0]).toEqual({ title: { contains: "50\\%\\_off", mode: "insensitive" } });
  });

  it("an empty search is treated the same as no search", () => {
    expect(buildFollowUpWhere({ view: "all", q: "", now: NOW }).OR).toBeUndefined();
  });
});
