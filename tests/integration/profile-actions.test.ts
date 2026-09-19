import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";

vi.mock("next/headers", () => import("../mocks/next-headers"));
vi.mock("next/navigation", () => import("../mocks/next-navigation"));

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { UnauthenticatedError } from "@/lib/rbac/authorize";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/profile";

let roleIds: Record<string, string>;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function signIn(userId: string) {
  const { token } = await createSession(userId, false);
  return token;
}

beforeAll(async () => {
  roleIds = await seedRolesAndPermissions();
}, 30_000);

afterEach(async () => {
  await truncateDynamicTables();
  headerMocks.__reset();
});

describe("updateProfileAction", () => {
  it("lets a signed-in user update their own profile", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "profile-a@test.local", password: "correct-horse-20" });
    await signIn(user.id);

    const result = await updateProfileAction(
      undefined,
      form({ firstName: "Updated", lastName: "Name", jobTitle: "Engineer", phone: "555-0100" }),
    );
    expect(result?.success).toBeTruthy();

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.firstName).toBe("Updated");
    expect(refreshed.jobTitle).toBe("Engineer");
  });

  it("throws UnauthenticatedError when no one is signed in", async () => {
    await expect(
      updateProfileAction(undefined, form({ firstName: "X", lastName: "Y" })),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe("changePasswordAction", () => {
  it("updates the hash and invalidates every session (including the current one) on success", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "profile-b@test.local", password: "old-password-10" });
    await signIn(user.id);
    await createSession(user.id, true); // a second session on another device

    await expect(
      changePasswordAction(
        undefined,
        form({ currentPassword: "old-password-10", newPassword: "new-password-10", confirmPassword: "new-password-10" }),
      ),
    ).rejects.toMatchObject({ url: "/login?passwordChanged=success" });

    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("new-password-10", refreshed.passwordHash)).toBe(true);
    expect(await db.auditLog.count({ where: { actorId: user.id, action: "PASSWORD_CHANGED" } })).toBe(1);
  });

  it("rejects an incorrect current password, leaving the hash and sessions untouched", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "profile-c@test.local", password: "old-password-11" });
    await signIn(user.id);

    const result = await changePasswordAction(
      undefined,
      form({ currentPassword: "wrong-current-password", newPassword: "new-password-11", confirmPassword: "new-password-11" }),
    );
    expect(result?.error).toMatch(/current password is incorrect/i);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("old-password-11", refreshed.passwordHash)).toBe(true);
  });
});
