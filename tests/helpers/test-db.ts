import crypto from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import {
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_DEFAULTS,
  type RoleKey,
} from "@/lib/rbac/permissions";

/** Clears everything except the Role/Permission/RolePermission seed, which is stable for the whole run. */
export async function truncateDynamicTables(): Promise<void> {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "AuditLog", "PasswordResetToken", "Session", "User", "Client" RESTART IDENTITY CASCADE;`,
  );
}

/**
 * Seeds roles + permissions from the exact same registry prisma/seed.ts
 * uses, with the same upsert-then-reconcile approach — so it's safe to call
 * from every test file's beforeAll even though they all share one database.
 * Returns role key -> id.
 */
export async function seedRolesAndPermissions(): Promise<Record<RoleKey, string>> {
  const roleIds = {} as Record<RoleKey, string>;
  for (const role of ROLE_DEFINITIONS) {
    const record = await db.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description },
      create: { key: role.key, name: role.name, description: role.description },
    });
    roleIds[role.key] = record.id;
  }

  const permissionIds = new Map<string, string>();
  for (const permission of PERMISSION_DEFINITIONS) {
    const record = await db.permission.upsert({
      where: { key: permission.key },
      update: { module: permission.module, action: permission.action, description: permission.description },
      create: {
        key: permission.key,
        module: permission.module,
        action: permission.action,
        description: permission.description,
      },
    });
    permissionIds.set(permission.key, record.id);
  }

  for (const [roleKey, permissionKeys] of Object.entries(ROLE_PERMISSION_DEFAULTS)) {
    const roleId = roleIds[roleKey as RoleKey];
    await db.rolePermission.deleteMany({ where: { roleId } });
    for (const key of permissionKeys) {
      await db.rolePermission.create({ data: { roleId, permissionId: permissionIds.get(key)! } });
    }
  }

  return roleIds;
}

export async function createTestUser(params: {
  roleId: string;
  email: string;
  password: string;
  status?: "ACTIVE" | "INACTIVE";
  firstName?: string;
  lastName?: string;
}) {
  const passwordHash = await hashPassword(params.password);
  return db.user.create({
    data: {
      firstName: params.firstName ?? "Test",
      lastName: params.lastName ?? "User",
      email: params.email,
      passwordHash,
      roleId: params.roleId,
      status: params.status ?? "ACTIVE",
    },
  });
}

/** Creates a real, database-backed session for a user and writes its cookie into the mocked cookie jar — the integration-test equivalent of "signing in". */
export async function signInAs(userId: string, rememberMe = false) {
  return createSession(userId, rememberMe);
}

/**
 * Inserts a session row directly, without going through `createSession` —
 * which also overwrites the mocked "current" cookie. Use this to give some
 * *other* user a pre-existing session (so a test can assert it gets
 * invalidated) without hijacking whichever user the test has actually
 * signed in as.
 */
export async function createRawSessionForUser(userId: string) {
  return db.session.create({
    data: {
      userId,
      tokenHash: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
}
