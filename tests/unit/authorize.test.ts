import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSION_DEFAULTS,
  type RoleKey,
} from "@/lib/rbac/permissions";

// Pure unit tests: `@/lib/session` is mocked wholesale, so the real
// session.ts (and therefore @/lib/db / DATABASE_URL) is never evaluated —
// no database needed for these.
const sessionState = vi.hoisted(() => ({ currentUser: null as unknown }));
vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(async () => sessionState.currentUser),
}));
vi.mock("next/navigation", () => import("../mocks/next-navigation"));

import { RedirectSignal } from "../mocks/next-navigation";
import { makeAuthenticatedUser } from "../fixtures/users";
import {
  ForbiddenError,
  UnauthenticatedError,
  requireAuth,
  requireAuthForAction,
  requirePermission,
  requirePermissionForAction,
  requireRole,
  requireRoleForAction,
} from "@/lib/rbac/authorize";

const ALL_ROLES: RoleKey[] = ["SUPER_ADMIN", "MANAGER", "EMPLOYEE", "INTERN"];

beforeEach(() => {
  sessionState.currentUser = null;
});

describe("requireAuth", () => {
  it("returns the current user when signed in", async () => {
    const user = makeAuthenticatedUser("EMPLOYEE");
    sessionState.currentUser = user;
    await expect(requireAuth()).resolves.toBe(user);
  });

  it("redirects to /login when signed out", async () => {
    sessionState.currentUser = null;
    await expect(requireAuth()).rejects.toMatchObject({ url: "/login" });
  });
});

describe("requireRole", () => {
  it.each(ALL_ROLES)("allows %s when its own role is listed", async (role) => {
    sessionState.currentUser = makeAuthenticatedUser(role);
    await expect(requireRole(role)).resolves.toBeDefined();
  });

  it.each(ALL_ROLES)("redirects %s to /unauthorized when role isn't listed", async (role) => {
    sessionState.currentUser = makeAuthenticatedUser(role);
    const otherRoles = ALL_ROLES.filter((r) => r !== role);
    await expect(requireRole(...otherRoles)).rejects.toMatchObject({ url: "/unauthorized" });
  });

  it("redirects to /login (not /unauthorized) when signed out", async () => {
    sessionState.currentUser = null;
    await expect(requireRole("SUPER_ADMIN")).rejects.toMatchObject({ url: "/login" });
  });
});

describe("requirePermission — full role x permission matrix", () => {
  // Generated straight from the same registry that seeds the real
  // database, so it can't drift from what each role actually grants.
  for (const role of ALL_ROLES) {
    for (const { key } of PERMISSION_DEFINITIONS) {
      const shouldHave = (ROLE_PERMISSION_DEFAULTS[role] as readonly string[]).includes(key);
      it(`${role} ${shouldHave ? "is allowed" : "is denied"} "${key}"`, async () => {
        sessionState.currentUser = makeAuthenticatedUser(role);
        if (shouldHave) {
          await expect(requirePermission(key)).resolves.toBeDefined();
        } else {
          await expect(requirePermission(key)).rejects.toMatchObject({ url: "/unauthorized" });
        }
      });
    }
  }
});

describe("requireAuthForAction", () => {
  it("returns the current user when signed in", async () => {
    const user = makeAuthenticatedUser("INTERN");
    sessionState.currentUser = user;
    await expect(requireAuthForAction()).resolves.toBe(user);
  });

  it("throws UnauthenticatedError (not a redirect) when signed out", async () => {
    sessionState.currentUser = null;
    await expect(requireAuthForAction()).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(requireAuthForAction()).rejects.not.toBeInstanceOf(RedirectSignal);
  });
});

describe("requireRoleForAction", () => {
  it.each(ALL_ROLES)("allows %s for its own role", async (role) => {
    sessionState.currentUser = makeAuthenticatedUser(role);
    await expect(requireRoleForAction(role)).resolves.toBeDefined();
  });

  it("throws ForbiddenError for a non-matching role", async () => {
    sessionState.currentUser = makeAuthenticatedUser("INTERN");
    await expect(requireRoleForAction("SUPER_ADMIN")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws UnauthenticatedError (never ForbiddenError) when signed out", async () => {
    sessionState.currentUser = null;
    await expect(requireRoleForAction("SUPER_ADMIN")).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe("requirePermissionForAction", () => {
  it("SUPER_ADMIN passes every permission (spot check)", async () => {
    sessionState.currentUser = makeAuthenticatedUser("SUPER_ADMIN");
    await expect(requirePermissionForAction("credentials.delete")).resolves.toBeDefined();
    await expect(requirePermissionForAction("users.delete")).resolves.toBeDefined();
  });

  it("MANAGER can users.update but not users.create", async () => {
    sessionState.currentUser = makeAuthenticatedUser("MANAGER");
    await expect(requirePermissionForAction("users.update")).resolves.toBeDefined();
    await expect(requirePermissionForAction("users.create")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("EMPLOYEE has no users.* permissions at all", async () => {
    sessionState.currentUser = makeAuthenticatedUser("EMPLOYEE");
    await expect(requirePermissionForAction("users.view")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("INTERN lacks settings.view", async () => {
    sessionState.currentUser = makeAuthenticatedUser("INTERN");
    await expect(requirePermissionForAction("settings.view")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws UnauthenticatedError (never ForbiddenError) when signed out", async () => {
    sessionState.currentUser = null;
    await expect(requirePermissionForAction("users.view")).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
