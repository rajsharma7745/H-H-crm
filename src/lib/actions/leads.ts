"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermissionForAction } from "@/lib/rbac/authorize";
import { logAuditEvent } from "@/lib/audit";
import { createLeadSchema, updateLeadSchema, STAGES_BY_PIPELINE, UNASSIGNED_REP } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";
import { TIME_ZONE_FIELD, zonedToUtc } from "@/lib/timezone";
import type { AuditAction, LeadPipeline, LeadStage, Prisma } from "@prisma/client";

const LEADS_PATH = "/leads";

function leadPath(leadId: string): string {
  return `${LEADS_PATH}/${leadId}`;
}

function pipelinePath(pipeline: LeadPipeline): string {
  return pipeline === "ADS" ? "/leads/ads" : "/leads/warm-approach";
}

/** Null-safe: an empty string means "no value" for every optional lead field. */
function orNull(value: string | undefined): string | null {
  return value ? value : null;
}

function orNullDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

/** A datetime-local value is wall-clock in the submitter's zone, not the server's. */
function orNullZonedDate(value: string | undefined, timeZone: FormDataEntryValue | null): Date | null {
  return value ? zonedToUtc(value, timeZone) : null;
}

function orNullInt(value: string | undefined): number | null {
  return value ? Number(value) : null;
}

function orNullOutcome(value: string | undefined): "WON" | "LOST" | null {
  return value === "WON" || value === "LOST" ? value : null;
}

/** Also treats the assigned-rep <Select>'s "Unassigned" sentinel as no rep. */
function orNullRepId(value: string | undefined): string | null {
  if (!value || value === UNASSIGNED_REP) return null;
  return value;
}

/** Mirrors resolveOwnerId in actions/clients.ts. */
async function resolveAssignedRepId(
  value: string | undefined,
): Promise<{ assignedRepId: string | null } | { error: string }> {
  const assignedRepId = orNullRepId(value);
  if (!assignedRepId) return { assignedRepId: null };
  const rep = await db.user.findUnique({ where: { id: assignedRepId } });
  if (!rep) return { error: "Selected representative does not exist." };
  return { assignedRepId };
}

/** Shared shape between create/update once the sentinel/date/number/outcome
 * conversions are applied to the Zod-validated string fields. */
function toLeadData(timeZone: FormDataEntryValue | null, rest: {
  companyName?: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  campaignName?: string;
  adCreative?: string;
  submittedAt?: string;
  initialContactStatus?: string;
  interestLevel?: string;
  qualificationNotes?: string;
  lastContactedAt?: string;
  immediateRequirement?: string;
  closingProbability?: string;
  meetingScheduled?: boolean;
  lastInteractionAt?: string;
  scheduledMeetingAt?: string;
  followUpNotes?: string;
  pitchedAt?: string;
  serviceDiscussed?: string;
  feedback?: string;
  nextAction?: string;
  proposalAmount?: string;
  proposalDocUrl?: string;
  proposalSentAt?: string;
  expectedCloseAt?: string;
  outcome?: string;
}) {
  return {
    companyName: orNull(rest.companyName),
    email: orNull(rest.email),
    phone: orNull(rest.phone),
    source: orNull(rest.source),
    notes: orNull(rest.notes),
    campaignName: orNull(rest.campaignName),
    adCreative: orNull(rest.adCreative),
    submittedAt: orNullDate(rest.submittedAt),
    initialContactStatus: orNull(rest.initialContactStatus),
    interestLevel: orNull(rest.interestLevel),
    qualificationNotes: orNull(rest.qualificationNotes),
    lastContactedAt: orNullDate(rest.lastContactedAt),
    immediateRequirement: orNull(rest.immediateRequirement),
    closingProbability: orNullInt(rest.closingProbability),
    meetingScheduled: rest.meetingScheduled ?? false,
    lastInteractionAt: orNullDate(rest.lastInteractionAt),
    scheduledMeetingAt: orNullZonedDate(rest.scheduledMeetingAt, timeZone),
    followUpNotes: orNull(rest.followUpNotes),
    pitchedAt: orNullDate(rest.pitchedAt),
    serviceDiscussed: orNull(rest.serviceDiscussed),
    feedback: orNull(rest.feedback),
    nextAction: orNull(rest.nextAction),
    proposalAmount: orNull(rest.proposalAmount),
    proposalDocUrl: orNull(rest.proposalDocUrl),
    proposalSentAt: orNullDate(rest.proposalSentAt),
    expectedCloseAt: orNullDate(rest.expectedCloseAt),
    outcome: orNullOutcome(rest.outcome),
  };
}

/** A pipeline-specific input only exists in the DOM for its own pipeline, so
 * `formData.get` returns null (not "") for the other pipeline's fields —
 * which the optional-string schemas reject. Absent means undefined. */
function field(formData: FormData, key: string): FormDataEntryValue | undefined {
  return formData.get(key) ?? undefined;
}

function readLeadFormData(formData: FormData) {
  return {
    name: field(formData, "name"),
    companyName: field(formData, "companyName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    pipeline: field(formData, "pipeline"),
    stage: field(formData, "stage"),
    source: field(formData, "source"),
    notes: field(formData, "notes"),
    assignedRepId: field(formData, "assignedRepId"),
    campaignName: field(formData, "campaignName"),
    adCreative: field(formData, "adCreative"),
    submittedAt: field(formData, "submittedAt"),
    initialContactStatus: field(formData, "initialContactStatus"),
    interestLevel: field(formData, "interestLevel"),
    qualificationNotes: field(formData, "qualificationNotes"),
    lastContactedAt: field(formData, "lastContactedAt"),
    immediateRequirement: field(formData, "immediateRequirement"),
    closingProbability: field(formData, "closingProbability"),
    meetingScheduled: formData.get("meetingScheduled") === "on",
    lastInteractionAt: field(formData, "lastInteractionAt"),
    scheduledMeetingAt: field(formData, "scheduledMeetingAt"),
    followUpNotes: field(formData, "followUpNotes"),
    pitchedAt: field(formData, "pitchedAt"),
    serviceDiscussed: field(formData, "serviceDiscussed"),
    feedback: field(formData, "feedback"),
    nextAction: field(formData, "nextAction"),
    proposalAmount: field(formData, "proposalAmount"),
    proposalDocUrl: field(formData, "proposalDocUrl"),
    proposalSentAt: field(formData, "proposalSentAt"),
    expectedCloseAt: field(formData, "expectedCloseAt"),
    // The <Select>'s "Undecided" item can't carry an empty-string value
    // (same Base UI constraint UNASSIGNED_OWNER/UNASSIGNED_REP work around),
    // so it submits this sentinel instead — normalize it back to "" here,
    // which the outcome schema and orNullOutcome() both already treat as
    // "no outcome yet".
    outcome: formData.get("outcome") === "undecided" ? "" : field(formData, "outcome"),
  };
}

export async function createLeadAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermissionForAction("leads.create");

  const parsed = createLeadSchema.safeParse(readLeadFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, pipeline, stage, assignedRepId, ...rest } = parsed.data;

  const repResult = await resolveAssignedRepId(assignedRepId);
  if ("error" in repResult) return { error: repResult.error };

  const created = await db.lead.create({
    data: {
      name,
      pipeline,
      stage,
      assignedRepId: repResult.assignedRepId,
      createdById: actor.id,
      ...toLeadData(formData.get(TIME_ZONE_FIELD), rest),
    },
  });

  await logAuditEvent({
    action: "LEAD_CREATED",
    actorId: actor.id,
    metadata: { leadId: created.id, name: created.name, pipeline: created.pipeline, stage: created.stage },
  });

  revalidatePath(LEADS_PATH);
  return { success: `${name} was added.` };
}

export async function updateLeadAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermissionForAction("leads.update");

  const parsed = updateLeadSchema.safeParse({ leadId: formData.get("leadId"), ...readLeadFormData(formData) });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { leadId, name, pipeline, stage, assignedRepId, ...rest } = parsed.data;

  // Independent lookups — run together instead of paying two sequential
  // round trips on every edit (mirrors updateClientAction).
  const [existing, repResult] = await Promise.all([
    db.lead.findUnique({ where: { id: leadId } }),
    resolveAssignedRepId(assignedRepId),
  ]);
  if (!existing) return { error: "Lead not found." };
  if ("error" in repResult) return { error: repResult.error };

  await db.lead.update({
    where: { id: leadId },
    data: {
      name,
      pipeline,
      stage,
      assignedRepId: repResult.assignedRepId,
      ...toLeadData(formData.get(TIME_ZONE_FIELD), rest),
    },
  });

  // Distinct audit events for the two changes that mean something beyond
  // "a field was edited" — a stage move and a reassignment. A save that
  // does neither just logs the generic LEAD_UPDATED.
  const events: { action: AuditAction; metadata: Prisma.InputJsonValue }[] = [];
  if (existing.stage !== stage) {
    events.push({
      action: "LEAD_STAGE_CHANGED",
      metadata: { leadId, name, fromStage: existing.stage, toStage: stage },
    });
  }
  if (existing.assignedRepId !== repResult.assignedRepId) {
    events.push({
      action: "LEAD_ASSIGNED",
      metadata: { leadId, name, fromRepId: existing.assignedRepId, toRepId: repResult.assignedRepId },
    });
  }
  if (events.length === 0) {
    events.push({ action: "LEAD_UPDATED", metadata: { leadId, name } });
  }

  await Promise.all(events.map((event) => logAuditEvent({ ...event, actorId: actor.id })));

  revalidatePath(LEADS_PATH);
  revalidatePath(leadPath(leadId));
  return { success: "Lead updated." };
}

/** Real delete (not Client's soft-deactivate) — the lead row is gone
 * afterward, so the snapshot in the audit metadata is the only remaining
 * record of what it was. */
export async function deleteLeadAction(formData: FormData): Promise<void> {
  const actor = await requirePermissionForAction("leads.delete");
  const leadId = String(formData.get("leadId") || "");
  if (!leadId) return;

  const existing = await db.lead.findUnique({ where: { id: leadId } });
  if (!existing) return;

  await db.lead.delete({ where: { id: leadId } });
  await logAuditEvent({
    action: "LEAD_DELETED",
    actorId: actor.id,
    metadata: { leadId, name: existing.name, pipeline: existing.pipeline, stage: existing.stage },
  });

  revalidatePath(LEADS_PATH);
}

/**
 * Lightweight assignment-only update for the lead detail page's "Assign
 * representative" quick action. Same narrow-action rationale as
 * moveLeadStageAction below.
 */
export async function assignLeadAction(formData: FormData): Promise<void> {
  const actor = await requirePermissionForAction("leads.update");
  const leadId = String(formData.get("leadId") || "");
  if (!leadId) return;

  const existing = await db.lead.findUnique({ where: { id: leadId } });
  if (!existing) throw new Error("Lead not found.");

  const repResult = await resolveAssignedRepId(String(formData.get("assignedRepId") || ""));
  if ("error" in repResult) throw new Error(repResult.error);
  if (repResult.assignedRepId === existing.assignedRepId) return;

  await db.lead.update({ where: { id: leadId }, data: { assignedRepId: repResult.assignedRepId } });
  await logAuditEvent({
    action: "LEAD_ASSIGNED",
    actorId: actor.id,
    metadata: {
      leadId,
      name: existing.name,
      fromRepId: existing.assignedRepId,
      toRepId: repResult.assignedRepId,
    },
  });

  revalidatePath(LEADS_PATH);
  revalidatePath(leadPath(leadId));
  revalidatePath(pipelinePath(existing.pipeline));
}

/**
 * Lightweight stage-only update for the Kanban boards' dropdown-move
 * control — a full updateLeadAction round trip would require resubmitting
 * every field on the lead just to change one. Throws (rather than returning
 * an ActionState) so the card's onClick handler can catch it and toast,
 * mirroring ClientRowActions' handleDeactivate pattern.
 */
export async function moveLeadStageAction(formData: FormData): Promise<void> {
  const actor = await requirePermissionForAction("leads.update");
  const leadId = String(formData.get("leadId") || "");
  const nextStage = String(formData.get("stage") || "") as LeadStage;
  if (!leadId || !nextStage) return;

  const existing = await db.lead.findUnique({ where: { id: leadId } });
  if (!existing) throw new Error("Lead not found.");

  const validStages = STAGES_BY_PIPELINE[existing.pipeline] as readonly LeadStage[];
  if (!validStages.includes(nextStage)) {
    throw new Error("That stage doesn't belong to this lead's pipeline.");
  }
  if (nextStage === existing.stage) return;

  await db.lead.update({ where: { id: leadId }, data: { stage: nextStage } });
  await logAuditEvent({
    action: "LEAD_STAGE_CHANGED",
    actorId: actor.id,
    metadata: { leadId, name: existing.name, fromStage: existing.stage, toStage: nextStage },
  });

  revalidatePath(LEADS_PATH);
  revalidatePath(leadPath(leadId));
  revalidatePath(pipelinePath(existing.pipeline));
}
