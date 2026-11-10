import type { AuditAction, FollowUpStatus, LeadActivityType, LeadStage } from "@prisma/client";

/**
 * Builds the lead detail page's single chronological story out of three
 * separate stores, WITHOUT merging the stores themselves:
 *
 *   - LeadActivity   — user-authored communication history (notes/calls/...)
 *   - AuditLog       — the security trail; only lead-scoped privileged events
 *                      (stage changes, assignments, edits) are surfaced here
 *   - FollowUp       — scheduled/completed follow-up work
 *
 * Pure and dependency-free so the ordering and labelling rules are unit
 * testable without a database or a renderer.
 */

export type TimelineKind = "activity" | "system" | "follow-up";

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  at: Date;
  label: string;
  detail: string | null;
  /** Display name of whoever caused the entry, when known. */
  actorName: string | null;
  /** Short tag shown next to the entry ("Call", "Stage change", ...). */
  tag: string;
};

const STAGE_LABEL: Record<LeadStage, string> = {
  COLD: "Cold",
  WARM: "Warm",
  HOT: "Hot",
  PLAN_MEET: "Plan Meet",
  PITCHED: "Pitched",
  PROPOSAL_SENT: "Proposal Sent",
};

const ACTIVITY_TAG: Record<LeadActivityType, string> = {
  NOTE: "Note",
  CALL: "Call",
  MEETING: "Meeting",
  EMAIL: "Email",
  OTHER: "Activity",
};

export type TimelineActivityInput = {
  id: string;
  type: LeadActivityType;
  title: string;
  description: string | null;
  activityAt: Date;
  createdBy: { firstName: string; lastName: string } | null;
};

export type TimelineAuditInput = {
  id: string;
  action: AuditAction;
  metadata: unknown;
  createdAt: Date;
  actor: { firstName: string; lastName: string } | null;
};

export type TimelineFollowUpInput = {
  id: string;
  title: string;
  status: FollowUpStatus;
  dueAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  assignedRep: { firstName: string; lastName: string } | null;
};

function fullName(person: { firstName: string; lastName: string } | null): string | null {
  return person ? `${person.firstName} ${person.lastName}` : null;
}

function describeAuditEntry(
  entry: TimelineAuditInput,
  repNameById: Map<string, string>,
): { label: string; tag: string } | null {
  const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
  switch (entry.action) {
    case "LEAD_CREATED":
      return { label: "created this lead", tag: "Created" };
    case "LEAD_STAGE_CHANGED": {
      const from = STAGE_LABEL[metadata.fromStage as LeadStage] ?? String(metadata.fromStage ?? "");
      const to = STAGE_LABEL[metadata.toStage as LeadStage] ?? String(metadata.toStage ?? "");
      return { label: `moved this lead from ${from} to ${to}`, tag: "Stage change" };
    }
    case "LEAD_ASSIGNED": {
      const toRepId = metadata.toRepId as string | null;
      if (!toRepId) return { label: "unassigned this lead", tag: "Assignment" };
      return {
        label: `assigned this lead to ${repNameById.get(toRepId) ?? "a team member"}`,
        tag: "Assignment",
      };
    }
    case "LEAD_UPDATED":
      return { label: "updated lead details", tag: "Edit" };
    default:
      // Every other audit action (logins, user management, follow-up and
      // activity bookkeeping) belongs to the audit log, not this timeline.
      return null;
  }
}

function describeFollowUp(followUp: TimelineFollowUpInput): { at: Date; label: string; tag: string } {
  if (followUp.status === "COMPLETED" && followUp.completedAt) {
    return {
      at: followUp.completedAt,
      label: `completed the follow-up "${followUp.title}"`,
      tag: "Follow-up done",
    };
  }
  if (followUp.status === "CANCELLED") {
    return { at: followUp.createdAt, label: `cancelled the follow-up "${followUp.title}"`, tag: "Follow-up" };
  }
  return {
    at: followUp.dueAt,
    label: `follow-up due: "${followUp.title}"`,
    tag: "Follow-up due",
  };
}

export function buildLeadTimeline(input: {
  activities: TimelineActivityInput[];
  auditEvents: TimelineAuditInput[];
  followUps: TimelineFollowUpInput[];
  /** id -> display name, used to name the target of an assignment event. */
  repNameById: Map<string, string>;
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const activity of input.activities) {
    entries.push({
      id: `activity-${activity.id}`,
      kind: "activity",
      at: activity.activityAt,
      label: activity.title,
      detail: activity.description,
      actorName: fullName(activity.createdBy),
      tag: ACTIVITY_TAG[activity.type],
    });
  }

  for (const event of input.auditEvents) {
    const described = describeAuditEntry(event, input.repNameById);
    if (!described) continue;
    entries.push({
      id: `system-${event.id}`,
      kind: "system",
      at: event.createdAt,
      label: described.label,
      detail: null,
      actorName: fullName(event.actor),
      tag: described.tag,
    });
  }

  for (const followUp of input.followUps) {
    const described = describeFollowUp(followUp);
    entries.push({
      id: `follow-up-${followUp.id}`,
      kind: "follow-up",
      at: described.at,
      label: described.label,
      detail: null,
      actorName: fullName(followUp.assignedRep),
      tag: described.tag,
    });
  }

  // Newest first. Ties broken by id so the order is stable between renders
  // rather than depending on whatever order the three queries came back in.
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));
}
