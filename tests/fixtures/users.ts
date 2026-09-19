import { UserStatus } from "@prisma/client";
import {
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_DEFAULTS,
  type RoleKey,
} from "@/lib/rbac/permissions";
import type { AuthenticatedUser } from "@/lib/session";

let counter = 0;

/**
 * Builds an in-memory user shaped exactly like `AuthenticatedUser`
 * (the Prisma payload `requireAuth`/`requirePermission` etc. operate on),
 * with its role's permission grants taken from the same
 * ROLE_PERMISSION_DEFAULTS registry that seeds the real database — so
 * these fixtures can never drift from what a real user of that role can
 * actually do.
 */
export function makeAuthenticatedUser(
  roleKey: RoleKey,
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  counter += 1;

  const roleDef = ROLE_DEFINITIONS.find((r) => r.key === roleKey);
  if (!roleDef) throw new Error(`Unknown role key: ${roleKey}`);

  const permissions = ROLE_PERMISSION_DEFAULTS[roleKey].map((key) => {
    const def = PERMISSION_DEFINITIONS.find((p) => p.key === key);
    if (!def) throw new Error(`Unknown permission key: ${key}`);
    return {
      id: `rp_${roleKey}_${key}`,
      roleId: `role_${roleKey}`,
      permissionId: `perm_${key}`,
      permission: {
        id: `perm_${key}`,
        key: def.key,
        module: def.module,
        action: def.action,
        description: def.description,
        createdAt: new Date(),
      },
    };
  });

  const user: AuthenticatedUser = {
    id: `user_${roleKey}_${counter}`,
    firstName: "Test",
    lastName: roleDef.name,
    email: `${roleKey.toLowerCase()}${counter}@test.local`,
    passwordHash: "unused-in-unit-tests",
    roleId: `role_${roleKey}`,
    profileImageUrl: null,
    phone: null,
    jobTitle: null,
    status: UserStatus.ACTIVE,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: `role_${roleKey}`,
      key: roleDef.key,
      name: roleDef.name,
      description: roleDef.description,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions,
    },
  };

  return { ...user, ...overrides };
}
