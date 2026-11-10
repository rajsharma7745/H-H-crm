import { describe, expect, it } from "vitest";
import { createLeadSchema, updateLeadSchema, STAGES_BY_PIPELINE, UNASSIGNED_REP } from "@/lib/validation";

const baseAdsLead = {
  name: "Jane Doe",
  companyName: "",
  email: "",
  phone: "",
  pipeline: "ADS" as const,
  stage: "COLD" as const,
  source: "",
  notes: "",
  assignedRepId: "",
  campaignName: "",
  adCreative: "",
  submittedAt: "",
  initialContactStatus: "",
  interestLevel: "",
  qualificationNotes: "",
  lastContactedAt: "",
  immediateRequirement: "",
  closingProbability: "",
  meetingScheduled: false,
  lastInteractionAt: "",
  scheduledMeetingAt: "",
  followUpNotes: "",
  pitchedAt: "",
  serviceDiscussed: "",
  feedback: "",
  nextAction: "",
  proposalAmount: "",
  proposalDocUrl: "",
  proposalSentAt: "",
  expectedCloseAt: "",
  outcome: "",
};

describe("STAGES_BY_PIPELINE", () => {
  it("matches the Ads and Warm Approach stage lists from the Lead Management brief", () => {
    expect(STAGES_BY_PIPELINE.ADS).toEqual(["COLD", "WARM", "HOT"]);
    expect(STAGES_BY_PIPELINE.WARM_APPROACH).toEqual(["PLAN_MEET", "PITCHED", "PROPOSAL_SENT"]);
  });
});

describe("createLeadSchema", () => {
  it("accepts a minimal, valid Ads lead", () => {
    const result = createLeadSchema.safeParse(baseAdsLead);
    expect(result.success).toBe(true);
  });

  it("accepts a minimal, valid Warm Approach lead", () => {
    const result = createLeadSchema.safeParse({ ...baseAdsLead, pipeline: "WARM_APPROACH", stage: "PLAN_MEET" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = createLeadSchema.safeParse({ ...baseAdsLead, name: "" });
    expect(result.success).toBe(false);
  });

  for (const stage of ["PLAN_MEET", "PITCHED", "PROPOSAL_SENT"]) {
    it(`rejects an Ads pipeline lead with the Warm Approach stage ${stage}`, () => {
      const result = createLeadSchema.safeParse({ ...baseAdsLead, pipeline: "ADS", stage });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes("stage"))).toBe(true);
      }
    });
  }

  for (const stage of ["COLD", "WARM", "HOT"]) {
    it(`rejects a Warm Approach pipeline lead with the Ads stage ${stage}`, () => {
      const result = createLeadSchema.safeParse({ ...baseAdsLead, pipeline: "WARM_APPROACH", stage });
      expect(result.success).toBe(false);
    });
  }

  it("rejects a closingProbability above 100", () => {
    const result = createLeadSchema.safeParse({ ...baseAdsLead, closingProbability: "150" });
    expect(result.success).toBe(false);
  });

  it("accepts a closingProbability of exactly 100", () => {
    const result = createLeadSchema.safeParse({ ...baseAdsLead, closingProbability: "100" });
    expect(result.success).toBe(true);
  });

  it("rejects a negative closingProbability", () => {
    const result = createLeadSchema.safeParse({ ...baseAdsLead, closingProbability: "-5" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid proposal amount", () => {
    const result = createLeadSchema.safeParse({
      ...baseAdsLead,
      pipeline: "WARM_APPROACH",
      stage: "PROPOSAL_SENT",
      proposalAmount: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid proposal amount with cents", () => {
    const result = createLeadSchema.safeParse({
      ...baseAdsLead,
      pipeline: "WARM_APPROACH",
      stage: "PROPOSAL_SENT",
      proposalAmount: "1200.50",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = createLeadSchema.safeParse({ ...baseAdsLead, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an outcome that isn't WON or LOST", () => {
    const result = createLeadSchema.safeParse({ ...baseAdsLead, outcome: "MAYBE" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty outcome (undecided)", () => {
    const result = createLeadSchema.safeParse({ ...baseAdsLead, outcome: "" });
    expect(result.success).toBe(true);
  });

  it("treats the UNASSIGNED_REP sentinel as a valid, parseable assignedRepId string", () => {
    const result = createLeadSchema.safeParse({ ...baseAdsLead, assignedRepId: UNASSIGNED_REP });
    expect(result.success).toBe(true);
  });
});

describe("updateLeadSchema", () => {
  it("requires a leadId in addition to the base fields", () => {
    const result = updateLeadSchema.safeParse(baseAdsLead);
    expect(result.success).toBe(false);
  });

  it("accepts a valid update payload with leadId", () => {
    const result = updateLeadSchema.safeParse({ leadId: "lead_1", ...baseAdsLead });
    expect(result.success).toBe(true);
  });

  it("still enforces pipeline-aware stage validation on update", () => {
    const result = updateLeadSchema.safeParse({ leadId: "lead_1", ...baseAdsLead, pipeline: "ADS", stage: "PITCHED" });
    expect(result.success).toBe(false);
  });
});
