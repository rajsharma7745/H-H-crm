"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { invalidateAllSessionsForUser } from "@/lib/session";
import { requirePermissionForAction } from "@/lib/rbac/authorize";
import { logAuditEvent } from "@/lib/audit";
import { createUserSchema, updateUserSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

const USERS_PATH = "/admin/users";

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermissionForAction("users.create");

  const parsed = createUserSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    jobTitle: formData.get("jobTitle"),
    phone: formData.get("phone"),
    temporaryPassword: formData.get("temporaryPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { firstName, lastName, email, roleId, jobTitle, phone, temporaryPassword } = parsed.data;

  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return { error: "Selected role does not exist." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with this email already exists." };

  const passwordHash = await hashPassword(temporaryPassword);

  const created = await db.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash,
      roleId,
      jobTitle: jobTitle || null,
      phone: phone || null,
    },
  });

  await logAuditEvent({
    action: "USER_CREATED",
    actorId: admin.id,
    targetId: created.id,
    metadata: { email, roleKey: role.key },
  });

  revalidatePath(USERS_PATH);
  return { success: `${firstName} ${lastName} was created.` };
}

export async function updateUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermissionForAction("users.update");

  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    roleId: formData.get("roleId"),
    jobTitle: formData.get("jobTitle"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { userId, firstName, lastName, roleId, jobTitle, phone } = parsed.data;

  const existing = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!existing) return { error: "User not found." };

  const newRole = await db.role.findUnique({ where: { id: roleId } });
  if (!newRole) return { error: "Selected role does not exist." };

  // Privilege-escalation guard: `users.update` (granted to Manager) is meant
  // for ordinary team management, not for minting new admins or editing the
  // admin account itself. Only a Super Admin may do either.
  if (admin.role.key !== "SUPER_ADMIN") {
    if (newRole.key === "SUPER_ADMIN") {
      return { error: "Only a Super Admin can grant Super Admin access." };
    }
    if (existing.role.key === "SUPER_ADMIN") {
      return { error: "Only a Super Admin can edit another Super Admin's account." };
    }
  }

  const roleChanged = existing.roleId !== roleId;

  await db.user.update({
    where: { id: userId },
    data: { firstName, lastName, roleId, jobTitle: jobTitle || null, phone: phone || null },
  });

  if (roleChanged) {
    // A role change alters what an existing session is allowed to do —
    // force that user to re-authenticate so the new permission set takes
    // effect immediately everywhere, not just on their next fresh login.
    await invalidateAllSessionsForUser(userId);
    await logAuditEvent({
      action: "USER_ROLE_CHANGED",
      actorId: admin.id,
      targetId: userId,
      metadata: { fromRole: existing.role.key, toRole: newRole.key },
    });
  } else {
    await logAuditEvent({ action: "USER_UPDATED", actorId: admin.id, targetId: userId });
  }

  revalidatePath(USERS_PATH);
  return { success: "User updated." };
}

export async function deactivateUserAction(formData: FormData): Promise<void> {
  const admin = await requirePermissionForAction("users.delete");
  const userId = String(formData.get("userId") || "");
  if (!userId) return;

  if (userId === admin.id) {
    // Prevent an admin locking themselves out. Thrown so the route's error
    // boundary / toast reports it rather than silently no-op'ing.
    throw new Error("You can't deactivate your own account.");
  }

  await db.user.update({ where: { id: userId }, data: { status: "INACTIVE" } });
  await invalidateAllSessionsForUser(userId);
  await logAuditEvent({ action: "USER_DEACTIVATED", actorId: admin.id, targetId: userId });

  revalidatePath(USERS_PATH);
}

export async function activateUserAction(formData: FormData): Promise<void> {
  const admin = await requirePermissionForAction("users.update");
  const userId = String(formData.get("userId") || "");
  if (!userId) return;

  await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  await logAuditEvent({ action: "USER_ACTIVATED", actorId: admin.id, targetId: userId });

  revalidatePath(USERS_PATH);
}
