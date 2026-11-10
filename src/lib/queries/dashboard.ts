import "server-only";

import { db } from "@/lib/db";
import { createdAtWhere, type ResolvedDateRange } from "@/lib/queries/date-range";
import { buildFollowUpViewWhere } from "@/lib/queries/follow-ups";

/**
 * Dashboard metrics, computed from real rows. Extracted from the page so the
 * aggregation can be integration-tested directly instead of only through a
 * rendered component.
 *
 * Metric definitions (these are the definitions the UI states verbatim):
 *   activeLeads      — created in range, outcome not yet Won or Lost
 *   adsLeads         — created in range, pipeline = ADS
 *   warmApproachLeads— created in range, pipeline = WARM_APPROACH
 *   byStage.*        — created in range, currently sitting in that stage
 *   proposalsSent    — created in range, currently in the Proposal Sent stage
 *   won / lost       — created in range, outcome = WON / LOST
 *   pendingFollowUps — status PENDING, as of `now`, IGNORING the date range
 *   overdueFollowUps — status PENDING and past due, as of `now`, ignoring range
 *
 * Follow-up health deliberately ignores the date range: "overdue follow-ups
 * among leads created in the last 7 days" is not a question anyone asks, and
 * showing it under an "Overdue" label would understate real risk.
 */
export type DashboardMetrics = {
  activeLeads: number;
  adsLeads: number;
  warmApproachLeads: number;
  byStage: {
    COLD: number;
    WARM: number;
    HOT: number;
    PLAN_MEET: number;
    PITCHED: number;
    PROPOSAL_SENT: number;
  };
  proposalsSent: number;
  won: number;
  lost: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
  /** Total leads in range — the denominator behind the distributions. */
  totalLeadsInRange: number;
};

export async function getDashboardMetrics(
  range: ResolvedDateRange,
  now: Date,
): Promise<DashboardMetrics> {
  const inRange = createdAtWhere(range);

  const [
    activeLeads,
    adsLeads,
    warmApproachLeads,
    cold,
    warm,
    hot,
    planMeet,
    pitched,
    proposalSent,
    won,
    lost,
    pendingFollowUps,
    overdueFollowUps,
    totalLeadsInRange,
  ] = await Promise.all([
    db.lead.count({ where: { ...inRange, outcome: null } }),
    db.lead.count({ where: { ...inRange, pipeline: "ADS" } }),
    db.lead.count({ where: { ...inRange, pipeline: "WARM_APPROACH" } }),
    db.lead.count({ where: { ...inRange, stage: "COLD" } }),
    db.lead.count({ where: { ...inRange, stage: "WARM" } }),
    db.lead.count({ where: { ...inRange, stage: "HOT" } }),
    db.lead.count({ where: { ...inRange, stage: "PLAN_MEET" } }),
    db.lead.count({ where: { ...inRange, stage: "PITCHED" } }),
    db.lead.count({ where: { ...inRange, stage: "PROPOSAL_SENT" } }),
    db.lead.count({ where: { ...inRange, outcome: "WON" } }),
    db.lead.count({ where: { ...inRange, outcome: "LOST" } }),
    db.followUp.count({ where: { status: "PENDING" } }),
    db.followUp.count({ where: buildFollowUpViewWhere("overdue", now) }),
    db.lead.count({ where: inRange }),
  ]);

  return {
    activeLeads,
    adsLeads,
    warmApproachLeads,
    byStage: { COLD: cold, WARM: warm, HOT: hot, PLAN_MEET: planMeet, PITCHED: pitched, PROPOSAL_SENT: proposalSent },
    proposalsSent: proposalSent,
    won,
    lost,
    pendingFollowUps,
    overdueFollowUps,
    totalLeadsInRange,
  };
}
