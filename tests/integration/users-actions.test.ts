import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createRawSessionForUser, createTestUser, seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";

vi.mock("next/headers", () => import("../mocks/next-headers"));
vi.mock("next/cache", () => import("../mocks/next-cache"));

import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { ForbiddenError } from "@/lib/rbac/authorize";
import {
  activateUserAction,
  createUserAction,
  deactivateUserAction,
  updateUserAction,
} from "@/lib/actions/users";

let roleIds: Record<string, string>;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function signIn(userId: string) {
  await createSession(userId, false);
}

beforeAll(async () => {
  roleIds = await seedRolesAndPermissions();
}, 30_000);

afterEach(async () => {
  await truncateDynamicTables();
  headerMocks.__reset();
});

describe("createUserAction", () => {
  it("a SUPER_ADMIN (has users.create) can create a new user", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-a@test.local", password: "admin-password-1" });
    await signIn(admin.id);

    const result = await createUserAction(
      undefined,
      form({
        firstName: "New",
        lastName: "Hire",
        email: "newhire@test.local",
        roleId: roleIds.EMPLOYEE,
        jobTitle: "",
        phone: "",
        temporaryPassword: "temporary-pw-1",
      }),
    );
    expect(result?.success).toBeTruthy();

    const created = await db.user.findUnique({ where: { email: "newhire@test.local" } });
    expect(created).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "USER_CREATED", targetId: created!.id } })).toBe(1);
  });

  it("unauthorized: a user without users.create (EMPLOYEE) is rejected", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-a@test.local", password: "employee-password-1" });
    await signIn(employee.id);

    await expect(
      createUserAction(
        undefined,
        form({
          firstName: "Should",
          lastName: "Fail",
          email: "shouldfail@test.local",
          roleId: roleIds.EMPLOYEE,
          jobTitle: "",
          phone: "",
          temporaryPassword: "temporary-pw-2",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await db.user.findUnique({ where: { email: "shouldfail@test.local" } })).toBeNull();
  });

  it("rejects a duplicate email", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-b@test.local", password: "admin-password-2" });
    await signIn(admin.id);
    const existing = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "dup@test.local", password: "existing-pw-1" });

    const result = await createUserAction(
      undefined,
      form({
        firstName: "Dup",
        lastName: "Licate",
        email: existing.email,
        roleId: roleIds.EMPLOYEE,
        jobTitle: "",
        phone: "",
        temporaryPassword: "temporary-pw-3",
      }),
    );
    expect(result?.error).toMatch(/already exists/i);
  });
});

describe("updateUserAction", () => {
  it("a MANAGER (has users.update) can edit an ordinary EMPLOYEE", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-a@test.local", password: "manager-password-1" });
    await signIn(manager.id);
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-b@test.local", password: "employee-password-2" });

    const result = await updateUserAction(
      undefined,
      form({ userId: employee.id, firstName: "Edited", lastName: employee.lastName, roleId: roleIds.EMPLOYEE, jobTitle: "", phone: "" }),
    );
    expect(result?.success).toBeTruthy();
    expect((await db.user.findUniqueOrThrow({ where: { id: employee.id } })).firstName).toBe("Edited");
  });

  it("unauthorized: a user without users.update (INTERN) is rejected", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-a@test.local", password: "intern-password-1" });
    await signIn(intern.id);
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-c@test.local", password: "employee-password-3" });

    await expect(
      updateUserAction(
        undefined,
        form({ userId: employee.id, firstName: "Nope", lastName: employee.lastName, roleId: roleIds.EMPLOYEE, jobTitle: "", phone: "" }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("role change invalidates the target's existing sessions and logs USER_ROLE_CHANGED", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-c@test.local", password: "admin-password-3" });
    await signIn(admin.id);
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-d@test.local", password: "employee-password-4" });
    await createRawSessionForUser(employee.id); // an existing session that must die on role change

    await updateUserAction(
      undefined,
      form({ userId: employee.id, firstName: employee.firstName, lastName: employee.lastName, roleId: roleIds.MANAGER, jobTitle: "", phone: "" }),
    );

    expect(await db.session.count({ where: { userId: employee.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "USER_ROLE_CHANGED", targetId: employee.id } })).toBe(1);
  });

  it("privilege escalation prevented: a MANAGER cannot grant SUPER_ADMIN access", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-b@test.local", password: "manager-password-2" });
    await signIn(manager.id);
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-e@test.local", password: "employee-password-5" });

    const result = await updateUserAction(
      undefined,
      form({ userId: employee.id, firstName: employee.firstName, lastName: employee.lastName, roleId: roleIds.SUPER_ADMIN, jobTitle: "", phone: "" }),
    );
    expect(result?.error).toMatch(/only a super admin can grant/i);
    expect((await db.user.findUniqueOrThrow({ where: { id: employee.id } })).roleId).toBe(roleIds.EMPLOYEE);
  });

  it("privilege escalation prevented: a MANAGER cannot edit an existing SUPER_ADMIN's account", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-c@test.local", password: "manager-password-3" });
    await signIn(manager.id);
    const otherAdmin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-d@test.local", password: "admin-password-4" });

    const result = await updateUserAction(
      undefined,
      // Submits a non-SUPER_ADMIN roleId so this hits the "editing an existing
      // Super Admin" guard specifically, not the "granting Super Admin" one.
      form({ userId: otherAdmin.id, firstName: "Hijacked", lastName: otherAdmin.lastName, roleId: roleIds.MANAGER, jobTitle: "", phone: "" }),
    );
    expect(result?.error).toMatch(/only a super admin can edit another super admin/i);
    expect((await db.user.findUniqueOrThrow({ where: { id: otherAdmin.id } })).firstName).not.toBe("Hijacked");
  });

  it("a SUPER_ADMIN can grant SUPER_ADMIN access and edit another admin's account", async () => {
    const rootAdmin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-e@test.local", password: "admin-password-5" });
    await signIn(rootAdmin.id);
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-f@test.local", password: "employee-password-6" });

    const result = await updateUserAction(
      undefined,
      form({ userId: employee.id, firstName: employee.firstName, lastName: employee.lastName, roleId: roleIds.SUPER_ADMIN, jobTitle: "", phone: "" }),
    );
    expect(result?.success).toBeTruthy();
    expect((await db.user.findUniqueOrThrow({ where: { id: employee.id } })).roleId).toBe(roleIds.SUPER_ADMIN);
  });
});

describe("deactivateUserAction / activateUserAction", () => {
  it("a SUPER_ADMIN (has users.delete) can deactivate a user: status flips, sessions die, audit logged", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-f@test.local", password: "admin-password-6" });
    await signIn(admin.id);
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-g@test.local", password: "employee-password-7" });
    await createRawSessionForUser(employee.id);

    await deactivateUserAction(form({ userId: employee.id }));

    expect((await db.user.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe("INACTIVE");
    expect(await db.session.count({ where: { userId: employee.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "USER_DEACTIVATED", targetId: employee.id } })).toBe(1);
  });

  it("an admin cannot deactivate their own account", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-g@test.local", password: "admin-password-7" });
    await signIn(admin.id);

    await expect(deactivateUserAction(form({ userId: admin.id }))).rejects.toThrow(/can't deactivate your own account/i);
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).status).toBe("ACTIVE");
  });

  it("unauthorized: a user without users.delete (MANAGER) cannot deactivate anyone", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-d@test.local", password: "manager-password-4" });
    await signIn(manager.id);
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-h@test.local", password: "employee-password-8" });

    await expect(deactivateUserAction(form({ userId: employee.id }))).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.user.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe("ACTIVE");
  });

  it("reactivating restores ACTIVE status and logs USER_ACTIVATED", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-h@test.local", password: "admin-password-8" });
    await signIn(admin.id);
    const employee = await createTestUser({
      roleId: roleIds.EMPLOYEE,
      email: "employee-i@test.local",
      password: "employee-password-9",
      status: "INACTIVE",
    });

    await activateUserAction(form({ userId: employee.id }));

    expect((await db.user.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe("ACTIVE");
    expect(await db.auditLog.count({ where: { action: "USER_ACTIVATED", targetId: employee.id } })).toBe(1);
  });
});
