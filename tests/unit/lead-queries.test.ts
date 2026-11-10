import { describe, expect, it } from "vitest";
import { buildLeadWhere, parseLeadPipelineFilter, parseLeadStageFilter } from "@/lib/queries/leads";

describe("parseLeadPipelineFilter", () => {
  it("passes through a valid pipeline", () => {
    expect(parseLeadPipelineFilter("ADS")).toBe("ADS");
    expect(parseLeadPipelineFilter("WARM_APPROACH")).toBe("WARM_APPROACH");
  });

  it("returns undefined for 'all', empty, or garbage values", () => {
    expect(parseLeadPipelineFilter("all")).toBeUndefined();
    expect(parseLeadPipelineFilter("")).toBeUndefined();
    expect(parseLeadPipelineFilter(undefined)).toBeUndefined();
    expect(parseLeadPipelineFilter("BOGUS")).toBeUndefined();
  });
});

describe("parseLeadStageFilter", () => {
  it("passes through any stage from either pipeline", () => {
    expect(parseLeadStageFilter("COLD")).toBe("COLD");
    expect(parseLeadStageFilter("PROPOSAL_SENT")).toBe("PROPOSAL_SENT");
  });

  it("returns undefined for 'all', empty, or garbage values", () => {
    expect(parseLeadStageFilter("all")).toBeUndefined();
    expect(parseLeadStageFilter("")).toBeUndefined();
    expect(parseLeadStageFilter(undefined)).toBeUndefined();
    expect(parseLeadStageFilter("NOT_A_STAGE")).toBeUndefined();
  });
});

describe("buildLeadWhere", () => {
  it("returns an empty filter when nothing is provided", () => {
    expect(buildLeadWhere({})).toEqual({});
  });

  it("ignores an unrecognized pipeline or stage value entirely", () => {
    expect(buildLeadWhere({ pipeline: "bogus", stage: "bogus" })).toEqual({});
  });

  it("filters by pipeline alone", () => {
    expect(buildLeadWhere({ pipeline: "ADS" })).toEqual({ pipeline: "ADS" });
  });

  it("filters by stage alone", () => {
    expect(buildLeadWhere({ stage: "HOT" })).toEqual({ stage: "HOT" });
  });

  it("filters by source alone (exact match)", () => {
    expect(buildLeadWhere({ source: "Referral" })).toEqual({ source: "Referral" });
  });

  it("filters by assigned rep alone", () => {
    expect(buildLeadWhere({ assignedRep: "user-123" })).toEqual({ assignedRepId: "user-123" });
  });

  it("builds a case-insensitive OR search across name, company, email and phone", () => {
    const where = buildLeadWhere({ q: "acme" });
    expect(where).toEqual({
      OR: [
        { name: { contains: "acme", mode: "insensitive" } },
        { companyName: { contains: "acme", mode: "insensitive" } },
        { email: { contains: "acme", mode: "insensitive" } },
        { phone: { contains: "acme", mode: "insensitive" } },
      ],
    });
  });

  it("combines search, pipeline, stage, source and assigned rep together", () => {
    const where = buildLeadWhere({ q: "acme", pipeline: "ADS", stage: "HOT", source: "Meta", assignedRep: "user-1" });
    expect(where).toMatchObject({ pipeline: "ADS", stage: "HOT", source: "Meta", assignedRepId: "user-1" });
    expect(where.OR).toBeDefined();
  });

  it("an empty search string is treated the same as no search", () => {
    expect(buildLeadWhere({ q: "" })).toEqual({});
  });

  it("escapes LIKE wildcards in the search term", () => {
    const where = buildLeadWhere({ q: "50%_off" });
    expect(where).toEqual({
      OR: [
        { name: { contains: "50\\%\\_off", mode: "insensitive" } },
        { companyName: { contains: "50\\%\\_off", mode: "insensitive" } },
        { email: { contains: "50\\%\\_off", mode: "insensitive" } },
        { phone: { contains: "50\\%\\_off", mode: "insensitive" } },
      ],
    });
  });
});
