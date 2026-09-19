import { describe, expect, it } from "vitest";
import { buildClientWhere, parseClientStatusFilter } from "@/lib/queries/clients";

describe("parseClientStatusFilter", () => {
  it("passes through a valid status", () => {
    expect(parseClientStatusFilter("ACTIVE")).toBe("ACTIVE");
    expect(parseClientStatusFilter("PROSPECT")).toBe("PROSPECT");
    expect(parseClientStatusFilter("PAUSED")).toBe("PAUSED");
    expect(parseClientStatusFilter("CHURNED")).toBe("CHURNED");
  });

  it("returns undefined for 'all', empty, or garbage values", () => {
    expect(parseClientStatusFilter("all")).toBeUndefined();
    expect(parseClientStatusFilter("")).toBeUndefined();
    expect(parseClientStatusFilter(undefined)).toBeUndefined();
    expect(parseClientStatusFilter("NOT_A_STATUS")).toBeUndefined();
  });
});

describe("buildClientWhere", () => {
  it("returns an empty filter when nothing is provided (no filters applied)", () => {
    expect(buildClientWhere({})).toEqual({});
  });

  it("ignores an unrecognized status value entirely", () => {
    expect(buildClientWhere({ status: "bogus" })).toEqual({});
  });

  it("filters by status alone", () => {
    expect(buildClientWhere({ status: "ACTIVE" })).toEqual({ status: "ACTIVE" });
  });

  it("filters by owner alone", () => {
    expect(buildClientWhere({ owner: "user-123" })).toEqual({ ownerId: "user-123" });
  });

  it("builds a case-insensitive OR search across name, contact name and email", () => {
    const where = buildClientWhere({ q: "acme" });
    expect(where).toEqual({
      OR: [
        { name: { contains: "acme", mode: "insensitive" } },
        { primaryContactName: { contains: "acme", mode: "insensitive" } },
        { primaryContactEmail: { contains: "acme", mode: "insensitive" } },
      ],
    });
  });

  it("combines search, status and owner filters together", () => {
    const where = buildClientWhere({ q: "acme", status: "PAUSED", owner: "user-1" });
    expect(where).toMatchObject({ status: "PAUSED", ownerId: "user-1" });
    expect(where.OR).toBeDefined();
  });

  it("an empty search string is treated the same as no search", () => {
    expect(buildClientWhere({ q: "" })).toEqual({});
  });
});
