"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermissionForAction } from "@/lib/rbac/authorize";
import { logAuditEvent } from "@/lib/audit";
import {
  createFollowUpSchema,
  updateFollowUpSchema,
  rescheduleFollowUpSchema,
  UNASSIGNED_REP,
} from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";
import { TIME_ZONE_FIELD, zonedToUtc } from "@/lib/timezone";

const FOLLOW_UPS_PATH = "/follow-ups";

/**
 * Follow-ups reuse the lead permissions rather than introducing new keys
 * (per the brief's "do not silently introduce new permissions"): they are
 * lead-scoped work, so viewing needs leads.view and any write needs
 * leads.update. In practice that means MANAGER/SUPER_ADMIN/EMPLOYEE can
 * manage follow-ups and INTERN (leads.view only) can only read them.
 */

function orNull(value: string | undefined): string | null {
  return value ? value : null;
}

function orNullRepId(value: string | undefined): string | null {
  if (!value || value === UNASSIGNED_REP) return null;
  return value;
}

async function resolveAssignedRepId(
  value: string | undefined,
): Promise<{ assignedRepId: string | null } | { error: string }> {
  const assignedRepId = orNullRepId(value);
  if (!assignedRepId) return { assignedRepId: null };
  const rep = await db.user.findUnique({ where: { id: assignedRepId } });
  if (!rep) return { error: "Selected representative does not exist." };
  return { assignedRepId };
}

function readFollowUpFormData(formData: FormData) {
  return {
    leadId: formData.get("leadId"),
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    dueAt: formData.get("dueAt"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    assignedRepId: formData.get("assignedRepId"),
  };
}

/** Revalidates every surface a follow-up shows up on. */
function revalidateFollowUpSurfaces(leadId: string) {
  revalidatePath(FOLLOW_UPS_PATH);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
}

export async function createFollowUpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermissionForAction("leads.update");

  const parsed = createFollowUpSchema.safeParse(readFollowUpFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { leadId, title, description, type, dueAt, status, priority, assignedRepId } = parsed.data;

  // A follow-up must hang off a real lead — never trust the submitted id.
  const [lead, repResult] = await Promise.all([
    db.lead.findUnique({ where: { id: leadId } }),
    resolveAssignedRepId(assignedRepId),
  ]);
  if (!lead) return { error: "That lead no longer exists." };
  if ("error" in repResult) return { error: repResult.error };

  const created = await db.followUp.create({
    data: {
      leadId,
      title,
      description: orNull(description),
      type,
      dueAt: zonedToUtc(dueAt, formData.get(TIME_ZONE_FIELD))!,
      status,
      priority,
      assignedRepId: repResult.assignedRepId,
      completedAt: status === "COMPLETED" ? new Date() : null,
      createdById: actor.id,
    },
  });

  await logAuditEvent({
    action: "FOLLOWUP_CREATED",
    actorId: actor.id,
    metadata: { followUpId: created.id, leadId, title, dueAt: created.dueAt.toISOString() },
  });

  revalidateFollowUpSurfaces(leadId);
  return { success: `Follow-up "${title}" was scheduled.` };
}

export async function updateFollowUpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermissionForAction("leads.update");

  const parsed = updateFollowUpSchema.safeParse({
    followUpId: formData.get("followUpId"),
    ...readFollowUpFormData(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { followUpId, leadId, title, description, type, dueAt, status, priority, assignedRepId } = parsed.data;

  const [existing, lead, repResult] = await Promise.all([
    db.followUp.findUnique({ where: { id: followUpId } }),
    db.lead.findUnique({ where: { id: leadId } }),
    resolveAssignedRepId(assignedRepId),
  ]);
  if (!existing) return { error: "Follow-up not found." };
  if (!lead) return { error: "That lead no longer exists." };
  if ("error" in repResult) return { error: repResult.error };

  const nowCompleted = status === "COMPLETED" && existing.status !== "COMPLETED";

  await db.followUp.update({
    where: { id: followUpId },
    data: {
      leadId,
      title,
      description: orNull(description),
      type,
      dueAt: zonedToUtc(dueAt, formData.get(TIME_ZONE_FIELD))!,
      status,
      priority,
      assignedRepId: repResult.assignedRepId,
      // Stamp on the transition into COMPLETED, clear it if reopened, and
      // otherwise leave the original completion time alone.
      completedAt: nowCompleted ? new Date() : status === "COMPLETED" ? existing.completedAt : null,
    },
  });

  await logAuditEvent({
    action: nowCompleted ? "FOLLOWUP_COMPLETED" : status === "CANCELLED" && existing.status !== "CANCELLED" ? "FOLLOWUP_CANCELLED" : "FOLLOWUP_UPDATED",
    actorId: actor.id,
    metadata: { followUpId, leadId, title },
  });

  revalidateFollowUpSurfaces(leadId);
  return { success: "Follow-up updated." };
}

/** Quick row action: mark done. Throws so the caller can toast. */
export async function completeFollowUpAction(formData: FormData): Promise<void> {
  const actor = await requirePermissionForAction("leads.update");
  const followUpId = String(formData.get("followUpId") || "");
  if (!followUpId) return;

  const existing = await db.followUp.findUnique({ where: { id: followUpId } });
  if (!existing) throw new Error("Follow-up not found.");
  if (existing.status === "COMPLETED") return;

  await db.followUp.update({
    where: { id: followUpId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await logAuditEvent({
    action: "FOLLOWUP_COMPLETED",
    actorId: actor.id,
    metadata: { followUpId, leadId: existing.leadId, title: existing.title },
  });

  revalidateFollowUpSurfaces(existing.leadId);
}

/** Quick row action: cancel (follow-ups are never hard-deleted). */
export async function cancelFollowUpAction(formData: FormData): Promise<void> {
  const actor = await requirePermissionForAction("leads.update");
  const followUpId = String(formData.get("followUpId") || "");
  if (!followUpId) return;

  const existing = await db.followUp.findUnique({ where: { id: followUpId } });
  if (!existing) throw new Error("Follow-up not found.");
  if (existing.status === "CANCELLED") return;

  await db.followUp.update({ where: { id: followUpId }, data: { status: "CANCELLED" } });

  await logAuditEvent({
    action: "FOLLOWUP_CANCELLED",
    actorId: actor.id,
    metadata: { followUpId, leadId: existing.leadId, title: existing.title },
  });

  revalidateFollowUpSurfaces(existing.leadId);
}

/** Quick row action: push the due date out (or pull it in). */
export async function rescheduleFollowUpAction(formData: FormData): Promise<void> {
  const actor = await requirePermissionForAction("leads.update");

  const parsed = rescheduleFollowUpSchema.safeParse({
    followUpId: formData.get("followUpId"),
    dueAt: formData.get("dueAt"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid due date.");
  }

  const dueAtUtc = zonedToUtc(parsed.data.dueAt, formData.get(TIME_ZONE_FIELD))!;
  const existing = await db.followUp.findUnique({ where: { id: parsed.data.followUpId } });
  if (!existing) throw new Error("Follow-up not found.");

  await db.followUp.update({
    where: { id: parsed.data.followUpId },
    data: {
      dueAt: dueAtUtc,
      // Rescheduling a done/cancelled follow-up reopens it — otherwise the
      // new date would be invisible in every pending view.
      status: "PENDING",
      completedAt: null,
    },
  });

  await logAuditEvent({
    action: "FOLLOWUP_UPDATED",
    actorId: actor.id,
    metadata: {
      followUpId: parsed.data.followUpId,
      leadId: existing.leadId,
      title: existing.title,
      fromDueAt: existing.dueAt.toISOString(),
      toDueAt: dueAtUtc.toISOString(),
    },
  });

  revalidateFollowUpSurfaces(existing.leadId);
}
