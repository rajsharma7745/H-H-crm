"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermissionForAction } from "@/lib/rbac/authorize";
import { logAuditEvent } from "@/lib/audit";
import { createLeadActivitySchema, updateLeadActivitySchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";
import { TIME_ZONE_FIELD, zonedToUtc } from "@/lib/timezone";

/**
 * Business communication history (notes/calls/meetings/emails), as opposed to
 * the security audit trail in AuditLog. Writes reuse leads.update for the
 * same reason follow-ups do — this is lead-scoped work, not a new permission
 * domain.
 */

function orNull(value: string | undefined): string | null {
  return value ? value : null;
}

function readActivityFormData(formData: FormData) {
  return {
    leadId: formData.get("leadId"),
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    activityAt: formData.get("activityAt"),
  };
}

export async function createLeadActivityAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermissionForAction("leads.update");

  const parsed = createLeadActivitySchema.safeParse(readActivityFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { leadId, type, title, description, activityAt } = parsed.data;

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "That lead no longer exists." };

  const created = await db.leadActivity.create({
    data: {
      leadId,
      type,
      title,
      description: orNull(description),
      activityAt: zonedToUtc(activityAt, formData.get(TIME_ZONE_FIELD))!,
      createdById: actor.id,
    },
  });

  await logAuditEvent({
    action: "LEAD_ACTIVITY_CREATED",
    actorId: actor.id,
    metadata: { activityId: created.id, leadId, type, title },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: "Activity logged." };
}

export async function updateLeadActivityAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermissionForAction("leads.update");

  const parsed = updateLeadActivitySchema.safeParse({
    activityId: formData.get("activityId"),
    ...readActivityFormData(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { activityId, leadId, type, title, description, activityAt } = parsed.data;

  const existing = await db.leadActivity.findUnique({ where: { id: activityId } });
  if (!existing) return { error: "Activity not found." };

  await db.leadActivity.update({
    where: { id: activityId },
    data: {
      type,
      title,
      description: orNull(description),
      activityAt: zonedToUtc(activityAt, formData.get(TIME_ZONE_FIELD))!,
    },
  });

  await logAuditEvent({
    action: "LEAD_ACTIVITY_UPDATED",
    actorId: actor.id,
    metadata: { activityId, leadId: existing.leadId, type, title },
  });

  revalidatePath(`/leads/${leadId}`);
  return { success: "Activity updated." };
}
