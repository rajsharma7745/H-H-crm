"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermissionForAction } from "@/lib/rbac/authorize";
import { logAuditEvent } from "@/lib/audit";
import { createClientSchema, updateClientSchema, UNASSIGNED_OWNER } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth";

const CLIENTS_PATH = "/clients";

function clientPath(clientId: string): string {
  return `${CLIENTS_PATH}/${clientId}`;
}

/** Null-safe: an empty string means "no value" for every optional client field. */
function orNull(value: string | undefined): string | null {
  return value ? value : null;
}

/** Also treats the owner <Select>'s "Unassigned" sentinel as no owner. */
function orNullOwnerId(value: string | undefined): string | null {
  if (!value || value === UNASSIGNED_OWNER) return null;
  return value;
}

/** Resolves and validates the submitted owner, mirroring the plain
 * check-and-return style users.ts uses for its roleId FK check — no
 * try/catch, so a real DB error surfaces as itself instead of being
 * mislabeled as "owner does not exist". */
async function resolveOwnerId(
  value: string | undefined,
): Promise<{ ownerId: string | null } | { error: string }> {
  const ownerId = orNullOwnerId(value);
  if (!ownerId) return { ownerId: null };
  const owner = await db.user.findUnique({ where: { id: ownerId } });
  if (!owner) return { error: "Selected owner does not exist." };
  return { ownerId };
}

export async function createClientAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermissionForAction("clients.create");

  const parsed = createClientSchema.safeParse({
    name: formData.get("name"),
    clientType: formData.get("clientType"),
    status: formData.get("status"),
    primaryContactName: formData.get("primaryContactName"),
    primaryContactEmail: formData.get("primaryContactEmail"),
    primaryContactPhone: formData.get("primaryContactPhone"),
    website: formData.get("website"),
    industry: formData.get("industry"),
    address: formData.get("address"),
    notes: formData.get("notes"),
    ownerId: formData.get("ownerId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, clientType, status, ownerId, ...rest } = parsed.data;

  const ownerResult = await resolveOwnerId(ownerId);
  if ("error" in ownerResult) return { error: ownerResult.error };

  const created = await db.client.create({
    data: {
      name,
      clientType,
      status,
      primaryContactName: orNull(rest.primaryContactName),
      primaryContactEmail: orNull(rest.primaryContactEmail),
      primaryContactPhone: orNull(rest.primaryContactPhone),
      website: orNull(rest.website),
      industry: orNull(rest.industry),
      address: orNull(rest.address),
      notes: orNull(rest.notes),
      ownerId: ownerResult.ownerId,
    },
  });

  await logAuditEvent({
    action: "CLIENT_CREATED",
    actorId: actor.id,
    metadata: { clientId: created.id, name: created.name },
  });

  revalidatePath(CLIENTS_PATH);
  return { success: `${name} was added.` };
}

export async function updateClientAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requirePermissionForAction("clients.update");

  const parsed = updateClientSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    clientType: formData.get("clientType"),
    status: formData.get("status"),
    primaryContactName: formData.get("primaryContactName"),
    primaryContactEmail: formData.get("primaryContactEmail"),
    primaryContactPhone: formData.get("primaryContactPhone"),
    website: formData.get("website"),
    industry: formData.get("industry"),
    address: formData.get("address"),
    notes: formData.get("notes"),
    ownerId: formData.get("ownerId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { clientId, name, clientType, status, ownerId, ...rest } = parsed.data;

  // Independent lookups — run together instead of paying two sequential
  // round trips on every edit.
  const [existing, ownerResult] = await Promise.all([
    db.client.findUnique({ where: { id: clientId } }),
    resolveOwnerId(ownerId),
  ]);
  if (!existing) return { error: "Client not found." };
  if ("error" in ownerResult) return { error: ownerResult.error };

  await db.client.update({
    where: { id: clientId },
    data: {
      name,
      clientType,
      status,
      primaryContactName: orNull(rest.primaryContactName),
      primaryContactEmail: orNull(rest.primaryContactEmail),
      primaryContactPhone: orNull(rest.primaryContactPhone),
      website: orNull(rest.website),
      industry: orNull(rest.industry),
      address: orNull(rest.address),
      notes: orNull(rest.notes),
      ownerId: ownerResult.ownerId,
    },
  });

  await logAuditEvent({
    action: "CLIENT_UPDATED",
    actorId: actor.id,
    metadata: { clientId, name },
  });

  revalidatePath(CLIENTS_PATH);
  revalidatePath(clientPath(clientId));
  return { success: "Client updated." };
}

export async function deactivateClientAction(formData: FormData): Promise<void> {
  const actor = await requirePermissionForAction("clients.delete");
  const clientId = String(formData.get("clientId") || "");
  if (!clientId) return;

  const existing = await db.client.findUnique({ where: { id: clientId } });
  if (!existing) return;

  await db.client.update({ where: { id: clientId }, data: { status: "CHURNED" } });
  await logAuditEvent({
    action: "CLIENT_DEACTIVATED",
    actorId: actor.id,
    metadata: { clientId, name: existing.name, fromStatus: existing.status },
  });

  revalidatePath(CLIENTS_PATH);
  revalidatePath(clientPath(clientId));
}

export async function activateClientAction(formData: FormData): Promise<void> {
  const actor = await requirePermissionForAction("clients.update");
  const clientId = String(formData.get("clientId") || "");
  if (!clientId) return;

  const existing = await db.client.findUnique({ where: { id: clientId } });
  if (!existing) return;

  await db.client.update({ where: { id: clientId }, data: { status: "ACTIVE" } });
  await logAuditEvent({
    action: "CLIENT_ACTIVATED",
    actorId: actor.id,
    metadata: { clientId, name: existing.name, fromStatus: existing.status },
  });

  revalidatePath(CLIENTS_PATH);
  revalidatePath(clientPath(clientId));
}
