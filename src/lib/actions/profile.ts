"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { invalidateAllSessionsForUser } from "@/lib/session";
import { requireAuthForAction } from "@/lib/rbac/authorize";
import { logAuditEvent } from "@/lib/audit";
import { changePasswordSchema, updateProfileSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

export async function updateProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthForAction();

  const parsed = updateProfileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    jobTitle: formData.get("jobTitle"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { firstName, lastName, jobTitle, phone } = parsed.data;

  await db.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      jobTitle: jobTitle || null,
      phone: phone || null,
    },
  });

  await logAuditEvent({
    action: "USER_UPDATED",
    actorId: user.id,
    targetId: user.id,
    metadata: { source: "self-service-profile" },
  });

  return { success: "Profile updated." };
}

export async function changePasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthForAction();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { currentPassword, newPassword } = parsed.data;

  const currentOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentOk) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  // End every session — including this one — so a changed password can't
  // coexist with a session opened under the old one.
  await invalidateAllSessionsForUser(user.id);
  await logAuditEvent({ action: "PASSWORD_CHANGED", actorId: user.id, targetId: user.id });

  redirect("/login?passwordChanged=success");
}
