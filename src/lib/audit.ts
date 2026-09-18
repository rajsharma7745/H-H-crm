import "server-only";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import type { AuditAction, Prisma } from "@prisma/client";

/**
 * Foundation for the future Activity/Audit module (Phase 7+). For Phase 1
 * this only records authentication and user-management security events.
 * Never pass raw passwords or reset tokens in `metadata`.
 */
export async function logAuditEvent(params: {
  action: AuditAction;
  actorId?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const h = await headers().catch(() => null);
  const ipAddress =
    h?.get("x-forwarded-for")?.split(",")[0]?.trim() || h?.get("x-real-ip") || null;
  const userAgent = h?.get("user-agent") || null;

  await db.auditLog.create({
    data: {
      action: params.action,
      actorId: params.actorId ?? null,
      targetId: params.targetId ?? null,
      metadata: params.metadata,
      ipAddress,
      userAgent,
    },
  });
}
