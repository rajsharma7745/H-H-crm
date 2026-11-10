import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";

vi.mock("next/headers", () => import("../mocks/next-headers"));
vi.mock("next/cache", () => import("../mocks/next-cache"));

import { db } from "@/lib/db";
import { resolveDateRange } from "@/lib/queries/date-range";
import { getDashboardMetrics } from "@/lib/queries/dashboard";
import {
  getConversionReport,
  getLeadsByPipeline,
  getLeadsBySource,
  getLeadsByStage,
  getLeadsCreatedOverTime,
  getStageMovements,
  getTeamPerformance,
  rate,
} from "@/lib/queries/reports";

const NOW = new Date(2026, 8, 29, 15, 0, 0, 0);

function daysBefore(days: number): Date {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  return date;
}

beforeAll(async () => {
  await seedRolesAndPermissions();
}, 30_000);

afterEach(async () => {
  await truncateDynamicTables();
  headerMocks.__reset();
});

/** Creates a lead with an explicit createdAt, so date filtering is testable. */
async function makeLead(overrides: {
  name: string;
  createdAt: Date;
  pipeline?: "ADS" | "WARM_APPROACH";
  stage?: "COLD" | "WARM" | "HOT" | "PLAN_MEET" | "PITCHED" | "PROPOSAL_SENT";
  outcome?: "WON" | "LOST" | null;
  source?: string | null;
  assignedRepId?: string | null;
}) {
  return db.lead.create({
    data: {
      name: overrides.name,
      pipeline: overrides.pipeline ?? "ADS",
      stage: overrides.stage ?? "COLD",
      outcome: overrides.outcome ?? null,
      source: overrides.source ?? null,
      assignedRepId: overrides.assignedRepId ?? null,
      createdAt: overrides.createdAt,
    },
  });
}

describe("getDashboardMetrics", () => {
  it("returns all-zero metrics (not nulls or crashes) on an empty database", async () => {
    const metrics = await getDashboardMetrics(resolveDateRange({ range: "30d" }, NOW), NOW);
    expect(metrics.activeLeads).toBe(0);
    expect(metrics.totalLeadsInRange).toBe(0);
    expect(metrics.byStage.COLD).toBe(0);
    expect(metrics.overdueFollowUps).toBe(0);
  });

  it("counts leads by pipeline, stage and outcome from real rows", async () => {
    await makeLead({ name: "Ads cold", createdAt: daysBefore(1), pipeline: "ADS", stage: "COLD" });
    await makeLead({ name: "Ads hot", createdAt: daysBefore(2), pipeline: "ADS", stage: "HOT" });
    await makeLead({
      name: "WA proposal won",
      createdAt: daysBefore(3),
      pipeline: "WARM_APPROACH",
      stage: "PROPOSAL_SENT",
      outcome: "WON",
    });
    await makeLead({
      name: "WA lost",
      createdAt: daysBefore(4),
      pipeline: "WARM_APPROACH",
      stage: "PITCHED",
      outcome: "LOST",
    });

    const metrics = await getDashboardMetrics(resolveDateRange({ range: "30d" }, NOW), NOW);

    expect(metrics.totalLeadsInRange).toBe(4);
    expect(metrics.adsLeads).toBe(2);
    expect(metrics.warmApproachLeads).toBe(2);
    expect(metrics.byStage.COLD).toBe(1);
    expect(metrics.byStage.HOT).toBe(1);
    expect(metrics.proposalsSent).toBe(1);
    expect(metrics.won).toBe(1);
    expect(metrics.lost).toBe(1);
    // "Active" excludes anything already won or lost.
    expect(metrics.activeLeads).toBe(2);
  });

  it("honors the date range when counting leads", async () => {
    await makeLead({ name: "Recent", createdAt: daysBefore(1) });
    await makeLead({ name: "Ancient", createdAt: daysBefore(100) });

    const last7 = await getDashboardMetrics(resolveDateRange({ range: "7d" }, NOW), NOW);
    const allTime = await getDashboardMetrics(resolveDateRange({ range: "all" }, NOW), NOW);

    expect(last7.totalLeadsInRange).toBe(1);
    expect(allTime.totalLeadsInRange).toBe(2);
  });

  it("counts follow-up health as of now, deliberately ignoring the date range", async () => {
    const lead = await makeLead({ name: "Old lead", createdAt: daysBefore(100) });
    await db.followUp.create({
      data: { leadId: lead.id, title: "Overdue", dueAt: daysBefore(2), status: "PENDING" },
    });
    await db.followUp.create({
      data: { leadId: lead.id, title: "Future", dueAt: new Date(2026, 9, 15), status: "PENDING" },
    });

    // The lead itself falls outside a 7-day window, but its overdue follow-up
    // still has to show up — that's the whole point of the definition.
    const metrics = await getDashboardMetrics(resolveDateRange({ range: "7d" }, NOW), NOW);
    expect(metrics.totalLeadsInRange).toBe(0);
    expect(metrics.pendingFollowUps).toBe(2);
    expect(metrics.overdueFollowUps).toBe(1);
  });
});

describe("report aggregations", () => {
  it("groups leads by pipeline, stage and source", async () => {
    await makeLead({ name: "A", createdAt: daysBefore(1), pipeline: "ADS", stage: "COLD", source: "Meta Ads" });
    await makeLead({ name: "B", createdAt: daysBefore(1), pipeline: "ADS", stage: "HOT", source: "Meta Ads" });
    await makeLead({
      name: "C",
      createdAt: daysBefore(1),
      pipeline: "WARM_APPROACH",
      stage: "PITCHED",
      source: null,
    });

    const filters = { range: resolveDateRange({ range: "30d" }, NOW) };

    expect(await getLeadsByPipeline(filters)).toEqual([
      { label: "Ads", count: 2 },
      { label: "Warm Approach", count: 1 },
    ]);

    const byStage = await getLeadsByStage(filters);
    expect(byStage.find((row) => row.label === "Cold")?.count).toBe(1);
    expect(byStage.find((row) => row.label === "Hot")?.count).toBe(1);
    expect(byStage.find((row) => row.label === "Pitched")?.count).toBe(1);

    const bySource = await getLeadsBySource(filters);
    expect(bySource[0]).toEqual({ label: "Meta Ads", count: 2 });
    expect(bySource.find((row) => row.label === "No source recorded")?.count).toBe(1);
  });

  it("restricts the stage breakdown to the filtered pipeline's own stages", async () => {
    await makeLead({ name: "A", createdAt: daysBefore(1), pipeline: "ADS", stage: "COLD" });
    const rows = await getLeadsByStage({ range: resolveDateRange({ range: "30d" }, NOW), pipeline: "ADS" });
    expect(rows.map((row) => row.label)).toEqual(["Cold", "Warm", "Hot"]);
  });

  it("buckets leads created over time by day", async () => {
    await makeLead({ name: "Day 1 a", createdAt: new Date(2026, 8, 20, 9, 0) });
    await makeLead({ name: "Day 1 b", createdAt: new Date(2026, 8, 20, 18, 0) });
    await makeLead({ name: "Day 2", createdAt: new Date(2026, 8, 21, 9, 0) });

    const rows = await getLeadsCreatedOverTime({ range: resolveDateRange({ range: "all" }, NOW) });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.count).toBe(2);
    expect(rows[1]?.count).toBe(1);
  });

  it("computes conversion rates with clear denominators, and null when a denominator is 0", async () => {
    const empty = await getConversionReport({ range: resolveDateRange({ range: "30d" }, NOW) });
    expect(empty.totalLeads).toBe(0);
    // Crucially null, not 0 — an empty pipeline is not a 0% conversion rate.
    expect(empty.hotRate).toBeNull();
    expect(empty.winRate).toBeNull();

    await makeLead({ name: "Hot one", createdAt: daysBefore(1), stage: "HOT" });
    await makeLead({ name: "Cold one", createdAt: daysBefore(1), stage: "COLD" });
    await makeLead({
      name: "Won one",
      createdAt: daysBefore(1),
      pipeline: "WARM_APPROACH",
      stage: "PROPOSAL_SENT",
      outcome: "WON",
    });

    const report = await getConversionReport({ range: resolveDateRange({ range: "30d" }, NOW) });
    expect(report.totalLeads).toBe(3);
    expect(report.reachedHot).toBe(1);
    expect(report.hotRate).toBeCloseTo(1 / 3);
    expect(report.proposalsSent).toBe(1);
    expect(report.won).toBe(1);
    expect(report.lost).toBe(0);
    expect(report.decided).toBe(1);
    // 1 won of 1 decided — 100%, even though 3 leads exist.
    expect(report.winRate).toBe(1);
  });

  it("rate() never divides by zero", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 0)).toBeNull();
    expect(rate(1, 4)).toBe(0.25);
  });

  it("summarizes stage movements from the audit trail", async () => {
    const lead = await makeLead({ name: "Mover", createdAt: daysBefore(1) });
    await db.auditLog.create({
      data: {
        action: "LEAD_STAGE_CHANGED",
        metadata: { leadId: lead.id, fromStage: "COLD", toStage: "WARM" },
        createdAt: daysBefore(1),
      },
    });
    await db.auditLog.create({
      data: {
        action: "LEAD_STAGE_CHANGED",
        metadata: { leadId: lead.id, fromStage: "COLD", toStage: "WARM" },
        createdAt: daysBefore(1),
      },
    });
    await db.auditLog.create({
      data: {
        action: "LEAD_STAGE_CHANGED",
        metadata: { leadId: lead.id, fromStage: "WARM", toStage: "HOT" },
        createdAt: daysBefore(1),
      },
    });
    // Junk metadata must be skipped rather than rendered as "undefined → undefined".
    await db.auditLog.create({
      data: { action: "LEAD_STAGE_CHANGED", metadata: { leadId: lead.id }, createdAt: daysBefore(1) },
    });

    const rows = await getStageMovements({ range: resolveDateRange({ range: "30d" }, NOW) });
    expect(rows).toEqual([
      { label: "Cold → Warm", count: 2 },
      { label: "Warm → Hot", count: 1 },
    ]);
  });

  it("builds per-rep performance rows and surfaces unassigned work", async () => {
    const role = await db.role.findFirstOrThrow({ where: { key: "EMPLOYEE" } });
    const rep = await db.user.create({
      data: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@test.local",
        passwordHash: "x",
        roleId: role.id,
      },
    });

    await makeLead({ name: "Ada hot", createdAt: daysBefore(1), stage: "HOT", assignedRepId: rep.id });
    await makeLead({ name: "Ada won", createdAt: daysBefore(1), outcome: "WON", assignedRepId: rep.id });
    const orphan = await makeLead({ name: "Nobody's lead", createdAt: daysBefore(1) });

    await db.followUp.create({
      data: { leadId: orphan.id, title: "Overdue orphan", dueAt: daysBefore(3), status: "PENDING" },
    });
    await db.followUp.create({
      data: {
        leadId: orphan.id,
        title: "Ada finished this",
        dueAt: daysBefore(5),
        status: "COMPLETED",
        completedAt: daysBefore(4),
        assignedRepId: rep.id,
      },
    });

    const rows = await getTeamPerformance({ range: resolveDateRange({ range: "30d" }, NOW) }, NOW);

    const adaRow = rows.find((row) => row.repId === rep.id)!;
    expect(adaRow.totalLeads).toBe(2);
    expect(adaRow.hot).toBe(1);
    expect(adaRow.won).toBe(1);
    expect(adaRow.followUpsCompleted).toBe(1);

    const unassignedRow = rows.find((row) => row.repId === null)!;
    expect(unassignedRow.repName).toBe("Unassigned");
    expect(unassignedRow.totalLeads).toBe(1);
    expect(unassignedRow.followUpsOverdue).toBe(1);
  });

  it("filters report data by assigned representative", async () => {
    const role = await db.role.findFirstOrThrow({ where: { key: "EMPLOYEE" } });
    const rep = await db.user.create({
      data: { firstName: "Grace", lastName: "Hopper", email: "grace@test.local", passwordHash: "x", roleId: role.id },
    });

    await makeLead({ name: "Theirs", createdAt: daysBefore(1), assignedRepId: rep.id });
    await makeLead({ name: "Someone else's", createdAt: daysBefore(1) });

    const scoped = await getConversionReport({
      range: resolveDateRange({ range: "30d" }, NOW),
      assignedRepId: rep.id,
    });
    expect(scoped.totalLeads).toBe(1);
  });
});
