import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createdAtWhere, type ResolvedDateRange } from "@/lib/queries/date-range";

/**
 * Report aggregations, computed from real rows. Extracted from the page so
 * every number can be integration-tested directly.
 *
 * A note on "unavailable" vs "zero" (the brief calls this out explicitly):
 * a rate whose denominator is 0 is returned as `null`, never as 0%. The UI
 * renders null as "—" with the denominator shown, so an empty pipeline can't
 * masquerade as a 0% conversion rate.
 */

export type ReportFilters = {
  range: ResolvedDateRange;
  pipeline?: "ADS" | "WARM_APPROACH";
  assignedRepId?: string;
};

export type CountRow = { label: string; count: number };

export type ConversionReport = {
  totalLeads: number;
  reachedHot: number;
  proposalsSent: number;
  won: number;
  lost: number;
  decided: number;
  /** reachedHot / totalLeads — null when there are no leads in scope. */
  hotRate: number | null;
  /** proposalsSent / totalLeads — null when there are no leads in scope. */
  proposalRate: number | null;
  /** won / (won + lost) — null when nothing has been decided yet. */
  winRate: number | null;
};

export type TeamPerformanceRow = {
  repId: string | null;
  repName: string;
  totalLeads: number;
  hot: number;
  proposalsSent: number;
  won: number;
  lost: number;
  followUpsCompleted: number;
  followUpsOverdue: number;
};

function leadWhere(filters: ReportFilters): Prisma.LeadWhereInput {
  return {
    ...createdAtWhere(filters.range),
    ...(filters.pipeline ? { pipeline: filters.pipeline } : {}),
    ...(filters.assignedRepId ? { assignedRepId: filters.assignedRepId } : {}),
  };
}

/** Safe division: null (not 0) when the denominator is 0. */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

/** Leads created per calendar day, oldest first, with empty days omitted. */
export async function getLeadsCreatedOverTime(filters: ReportFilters): Promise<CountRow[]> {
  const leads = await db.lead.findMany({
    where: leadWhere(filters),
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, number>();
  for (const lead of leads) {
    const key = new Date(lead.createdAt).toLocaleDateString("en-CA"); // YYYY-MM-DD
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  return [...byDay.entries()].map(([label, count]) => ({ label, count }));
}

/** Leads grouped by a nullable free-text column (source / campaign name). */
async function groupByTextColumn(
  filters: ReportFilters,
  column: "source" | "campaignName",
  unsetLabel: string,
): Promise<CountRow[]> {
  const grouped = await db.lead.groupBy({
    by: [column],
    where: leadWhere(filters),
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({
      label: (row[column] as string | null) ?? unsetLabel,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function getLeadsBySource(filters: ReportFilters): Promise<CountRow[]> {
  return groupByTextColumn(filters, "source", "No source recorded");
}

export function getLeadsByCampaign(filters: ReportFilters): Promise<CountRow[]> {
  return groupByTextColumn(filters, "campaignName", "No campaign recorded");
}

export async function getLeadsByPipeline(filters: ReportFilters): Promise<CountRow[]> {
  const grouped = await db.lead.groupBy({
    by: ["pipeline"],
    where: leadWhere(filters),
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((row) => [row.pipeline, row._count._all]));
  return [
    { label: "Ads", count: counts.get("ADS") ?? 0 },
    { label: "Warm Approach", count: counts.get("WARM_APPROACH") ?? 0 },
  ];
}

const STAGE_ORDER = ["COLD", "WARM", "HOT", "PLAN_MEET", "PITCHED", "PROPOSAL_SENT"] as const;
const STAGE_LABEL: Record<(typeof STAGE_ORDER)[number], string> = {
  COLD: "Cold",
  WARM: "Warm",
  HOT: "Hot",
  PLAN_MEET: "Plan Meet",
  PITCHED: "Pitched",
  PROPOSAL_SENT: "Proposal Sent",
};

export async function getLeadsByStage(filters: ReportFilters): Promise<CountRow[]> {
  const grouped = await db.lead.groupBy({
    by: ["stage"],
    where: leadWhere(filters),
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((row) => [row.stage, row._count._all]));
  return STAGE_ORDER
    // When a pipeline filter is on, the other pipeline's stages are noise.
    .filter((stage) => {
      if (!filters.pipeline) return true;
      const isAdsStage = stage === "COLD" || stage === "WARM" || stage === "HOT";
      return filters.pipeline === "ADS" ? isAdsStage : !isAdsStage;
    })
    .map((stage) => ({ label: STAGE_LABEL[stage], count: counts.get(stage) ?? 0 }));
}

/**
 * Average days a lead has been sitting in its current stage, per stage.
 * "Aging" is measured from the lead's last update (the closest proxy we have
 * for when it last moved), so it is only meaningful for leads that haven't
 * been edited for other reasons — labelled as such in the UI.
 */
export async function getStageAging(filters: ReportFilters, now: Date): Promise<CountRow[]> {
  const leads = await db.lead.findMany({
    where: leadWhere(filters),
    select: { stage: true, updatedAt: true },
  });

  const totals = new Map<string, { days: number; count: number }>();
  for (const lead of leads) {
    const days = (now.getTime() - new Date(lead.updatedAt).getTime()) / 86_400_000;
    const current = totals.get(lead.stage) ?? { days: 0, count: 0 };
    totals.set(lead.stage, { days: current.days + days, count: current.count + 1 });
  }

  return STAGE_ORDER.filter((stage) => totals.has(stage)).map((stage) => {
    const entry = totals.get(stage)!;
    return { label: STAGE_LABEL[stage], count: Math.round((entry.days / entry.count) * 10) / 10 };
  });
}

/** Stage movements recorded in the audit log, grouped by "From → To". */
export async function getStageMovements(filters: ReportFilters): Promise<CountRow[]> {
  const events = await db.auditLog.findMany({
    where: {
      action: "LEAD_STAGE_CHANGED",
      ...(() => {
        const createdAt = createdAtWhere(filters.range).createdAt;
        return createdAt ? { createdAt } : {};
      })(),
    },
    select: { metadata: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const byTransition = new Map<string, number>();
  for (const event of events) {
    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    const from = metadata.fromStage as keyof typeof STAGE_LABEL | undefined;
    const to = metadata.toStage as keyof typeof STAGE_LABEL | undefined;
    if (!from || !to || !STAGE_LABEL[from] || !STAGE_LABEL[to]) continue;
    const label = `${STAGE_LABEL[from]} → ${STAGE_LABEL[to]}`;
    byTransition.set(label, (byTransition.get(label) ?? 0) + 1);
  }

  return [...byTransition.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function getConversionReport(filters: ReportFilters): Promise<ConversionReport> {
  const where = leadWhere(filters);

  const [totalLeads, reachedHot, proposalsSent, won, lost] = await Promise.all([
    db.lead.count({ where }),
    db.lead.count({ where: { ...where, stage: "HOT" } }),
    db.lead.count({ where: { ...where, stage: "PROPOSAL_SENT" } }),
    db.lead.count({ where: { ...where, outcome: "WON" } }),
    db.lead.count({ where: { ...where, outcome: "LOST" } }),
  ]);

  const decided = won + lost;

  return {
    totalLeads,
    reachedHot,
    proposalsSent,
    won,
    lost,
    decided,
    hotRate: rate(reachedHot, totalLeads),
    proposalRate: rate(proposalsSent, totalLeads),
    winRate: rate(won, decided),
  };
}

export async function getTeamPerformance(filters: ReportFilters, now: Date): Promise<TeamPerformanceRow[]> {
  const where = leadWhere(filters);

  const [reps, leads, followUpsCompleted, followUpsOverdue] = await Promise.all([
    db.user.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.lead.findMany({ where, select: { assignedRepId: true, stage: true, outcome: true } }),
    db.followUp.groupBy({ by: ["assignedRepId"], where: { status: "COMPLETED" }, _count: { _all: true } }),
    db.followUp.groupBy({
      by: ["assignedRepId"],
      where: { status: "PENDING", dueAt: { lt: now } },
      _count: { _all: true },
    }),
  ]);

  const completedByRep = new Map(followUpsCompleted.map((row) => [row.assignedRepId, row._count._all]));
  const overdueByRep = new Map(followUpsOverdue.map((row) => [row.assignedRepId, row._count._all]));

  const blank = () => ({ totalLeads: 0, hot: 0, proposalsSent: 0, won: 0, lost: 0 });
  const leadStats = new Map<string | null, ReturnType<typeof blank>>();
  for (const lead of leads) {
    const key = lead.assignedRepId;
    const stats = leadStats.get(key) ?? blank();
    stats.totalLeads += 1;
    if (lead.stage === "HOT") stats.hot += 1;
    if (lead.stage === "PROPOSAL_SENT") stats.proposalsSent += 1;
    if (lead.outcome === "WON") stats.won += 1;
    if (lead.outcome === "LOST") stats.lost += 1;
    leadStats.set(key, stats);
  }

  const rows: TeamPerformanceRow[] = reps.map((rep) => ({
    repId: rep.id,
    repName: `${rep.firstName} ${rep.lastName}`,
    ...(leadStats.get(rep.id) ?? blank()),
    followUpsCompleted: completedByRep.get(rep.id) ?? 0,
    followUpsOverdue: overdueByRep.get(rep.id) ?? 0,
  }));

  // Unassigned work is real work — surface it rather than hiding it.
  const unassignedLeads = leadStats.get(null);
  const unassignedCompleted = completedByRep.get(null) ?? 0;
  const unassignedOverdue = overdueByRep.get(null) ?? 0;
  if (unassignedLeads || unassignedCompleted || unassignedOverdue) {
    rows.push({
      repId: null,
      repName: "Unassigned",
      ...(unassignedLeads ?? blank()),
      followUpsCompleted: unassignedCompleted,
      followUpsOverdue: unassignedOverdue,
    });
  }

  // Drop reps with nothing at all in scope, so the table stays readable.
  return rows.filter(
    (row) => row.totalLeads > 0 || row.followUpsCompleted > 0 || row.followUpsOverdue > 0,
  );
}
