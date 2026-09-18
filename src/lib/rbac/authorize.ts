import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, type AuthenticatedUser } from "@/lib/session";
import type { PermissionKey, RoleKey } from "@/lib/rbac/permissions";

/**
 * Centralized authorization. Every protected page, layout, server action and
 * route handler must go through one of these — never re-implement a role or
 * permission check inline, and never trust a client-side check alone.
 */

export function userHasPermission(
  user: Pick<AuthenticatedUser, "role">,
  ...anyOf: PermissionKey[]
): boolean {
  const granted = new Set(user.role.permissions.map((rp) => rp.permission.key));
  return anyOf.some((key) => granted.has(key));
}

export function userHasRole(
  user: Pick<AuthenticatedUser, "role">,
  ...anyOf: RoleKey[]
): boolean {
  return anyOf.includes(user.role.key as RoleKey);
}

/** Thrown by the *ForAction variants instead of redirecting, so a server
 * action can return a structured error to the form instead of hard-navigating. */
export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "You must be signed in.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

// ---------------------------------------------------------------------------
// For Server Components / layouts / route handlers — redirect on failure.
// ---------------------------------------------------------------------------

/** Requires a signed-in, active user. Redirects to /login otherwise. */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires one of the given roles. Redirects to /unauthorized otherwise. */
export async function requireRole(...anyOf: RoleKey[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!userHasRole(user, ...anyOf)) redirect("/unauthorized");
  return user;
}

/** Requires one of the given permissions. Redirects to /unauthorized otherwise. */
export async function requirePermission(
  ...anyOf: PermissionKey[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!userHasPermission(user, ...anyOf)) redirect("/unauthorized");
  return user;
}

// ---------------------------------------------------------------------------
// For Server Actions — throw instead of redirecting, so the caller can
// surface a friendly inline error instead of hard-navigating away mid-form.
// ---------------------------------------------------------------------------

export async function requireAuthForAction(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function requirePermissionForAction(
  ...anyOf: PermissionKey[]
): Promise<AuthenticatedUser> {
  const user = await requireAuthForAction();
  if (!userHasPermission(user, ...anyOf)) throw new ForbiddenError();
  return user;
}

export async function requireRoleForAction(...anyOf: RoleKey[]): Promise<AuthenticatedUser> {
  const user = await requireAuthForAction();
  if (!userHasRole(user, ...anyOf)) throw new ForbiddenError();
  return user;
}
