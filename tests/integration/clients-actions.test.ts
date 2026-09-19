import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";

vi.mock("next/headers", () => import("../mocks/next-headers"));
vi.mock("next/cache", () => import("../mocks/next-cache"));

import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { ForbiddenError } from "@/lib/rbac/authorize";
import { UNASSIGNED_OWNER } from "@/lib/validation";
import {
  activateClientAction,
  createClientAction,
  deactivateClientAction,
  updateClientAction,
} from "@/lib/actions/clients";

let roleIds: Record<string, string>;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function signIn(userId: string) {
  await createSession(userId, false);
}

const BASE_CLIENT_FIELDS = {
  name: "Acme Corp",
  clientType: "B2B",
  status: "PROSPECT",
  primaryContactName: "Jane Doe",
  primaryContactEmail: "jane@acme.com",
  primaryContactPhone: "555-0100",
  website: "https://acme.com",
  industry: "Retail",
  address: "123 Main St",
  notes: "Met at a trade show.",
  ownerId: "",
};

beforeAll(async () => {
  roleIds = await seedRolesAndPermissions();
}, 30_000);

afterEach(async () => {
  await truncateDynamicTables();
  headerMocks.__reset();
});

describe("createClientAction", () => {
  it("a MANAGER (has clients.create) can create a new client", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-a@test.local", password: "manager-password-1" });
    await signIn(manager.id);

    const result = await createClientAction(undefined, form(BASE_CLIENT_FIELDS));
    expect(result?.success).toBeTruthy();

    const created = await db.client.findFirst({ where: { name: "Acme Corp" } });
    expect(created).not.toBeNull();
    expect(created?.primaryContactEmail).toBe("jane@acme.com");
    expect(created?.status).toBe("PROSPECT");
    expect(await db.auditLog.count({ where: { action: "CLIENT_CREATED" } })).toBe(1);

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "CLIENT_CREATED" } });
    expect(audit.actorId).toBe(manager.id);
    expect((audit.metadata as { clientId?: string })?.clientId).toBe(created!.id);
  });

  it("unauthorized: a user without clients.create (EMPLOYEE) is rejected", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-a@test.local", password: "employee-password-1" });
    await signIn(employee.id);

    await expect(createClientAction(undefined, form(BASE_CLIENT_FIELDS))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.client.count()).toBe(0);
  });

  it("unauthorized: an INTERN (view only) is rejected", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-a@test.local", password: "intern-password-1" });
    await signIn(intern.id);

    await expect(createClientAction(undefined, form(BASE_CLIENT_FIELDS))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a missing client name (server-side validation, not just UI)", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-b@test.local", password: "manager-password-2" });
    await signIn(manager.id);

    const result = await createClientAction(undefined, form({ ...BASE_CLIENT_FIELDS, name: "" }));
    expect(result?.error).toMatch(/name is required/i);
    expect(await db.client.count()).toBe(0);
  });

  it("rejects an invalid contact email", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-c@test.local", password: "manager-password-3" });
    await signIn(manager.id);

    const result = await createClientAction(
      undefined,
      form({ ...BASE_CLIENT_FIELDS, primaryContactEmail: "not-an-email" }),
    );
    expect(result?.error).toBeTruthy();
    expect(await db.client.count()).toBe(0);
  });

  it("normalizes the Unassigned owner sentinel to a null owner", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-d@test.local", password: "manager-password-4" });
    await signIn(manager.id);

    const result = await createClientAction(undefined, form({ ...BASE_CLIENT_FIELDS, ownerId: UNASSIGNED_OWNER }));
    expect(result?.success).toBeTruthy();

    const created = await db.client.findFirstOrThrow({ where: { name: "Acme Corp" } });
    expect(created.ownerId).toBeNull();
  });

  it("assigns a real owner when a valid user id is given", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-e@test.local", password: "manager-password-5" });
    const futureOwner = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "owner-a@test.local", password: "owner-password-1" });
    await signIn(manager.id);

    const result = await createClientAction(undefined, form({ ...BASE_CLIENT_FIELDS, ownerId: futureOwner.id }));
    expect(result?.success).toBeTruthy();

    const created = await db.client.findFirstOrThrow({ where: { name: "Acme Corp" } });
    expect(created.ownerId).toBe(futureOwner.id);
  });

  it("rejects an ownerId that doesn't reference a real user", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-f@test.local", password: "manager-password-6" });
    await signIn(manager.id);

    const result = await createClientAction(undefined, form({ ...BASE_CLIENT_FIELDS, ownerId: "does-not-exist" }));
    expect(result?.error).toMatch(/owner does not exist/i);
    expect(await db.client.count()).toBe(0);
  });
});

describe("updateClientAction", () => {
  it("a MANAGER (has clients.update) can edit a client, including its status", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-g@test.local", password: "manager-password-7" });
    await signIn(manager.id);
    const client = await db.client.create({ data: { name: "Old Name", status: "PROSPECT" } });

    const result = await updateClientAction(
      undefined,
      form({ ...BASE_CLIENT_FIELDS, clientId: client.id, name: "New Name", status: "ACTIVE" }),
    );
    expect(result?.success).toBeTruthy();

    const refreshed = await db.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(refreshed.name).toBe("New Name");
    expect(refreshed.status).toBe("ACTIVE");
    expect(await db.auditLog.count({ where: { action: "CLIENT_UPDATED" } })).toBe(1);
  });

  it("unauthorized: a user without clients.update (EMPLOYEE) is rejected", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-b@test.local", password: "employee-password-2" });
    await signIn(employee.id);
    const client = await db.client.create({ data: { name: "Untouched", status: "PROSPECT" } });

    await expect(
      updateClientAction(undefined, form({ ...BASE_CLIENT_FIELDS, clientId: client.id })),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect((await db.client.findUniqueOrThrow({ where: { id: client.id } })).name).toBe("Untouched");
  });

  it("updating a nonexistent client returns a friendly error instead of throwing", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-h@test.local", password: "manager-password-8" });
    await signIn(manager.id);

    const result = await updateClientAction(
      undefined,
      form({ ...BASE_CLIENT_FIELDS, clientId: "does-not-exist" }),
    );
    expect(result?.error).toMatch(/not found/i);
  });

  it("rejects an invalid website on update", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-i@test.local", password: "manager-password-9" });
    await signIn(manager.id);
    const client = await db.client.create({ data: { name: "Some Client", status: "PROSPECT" } });

    const result = await updateClientAction(
      undefined,
      form({ ...BASE_CLIENT_FIELDS, clientId: client.id, website: "not a url" }),
    );
    expect(result?.error).toBeTruthy();
  });
});

describe("deactivateClientAction / activateClientAction", () => {
  it("a SUPER_ADMIN (has clients.delete) can deactivate a client: status -> CHURNED, audit logged", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-a@test.local", password: "admin-password-1" });
    await signIn(admin.id);
    const client = await db.client.create({ data: { name: "Deactivate Me", status: "ACTIVE" } });

    await deactivateClientAction(form({ clientId: client.id }));

    expect((await db.client.findUniqueOrThrow({ where: { id: client.id } })).status).toBe("CHURNED");
    expect(await db.auditLog.count({ where: { action: "CLIENT_DEACTIVATED" } })).toBe(1);
  });

  it("unauthorized: a MANAGER (no clients.delete) cannot deactivate a client", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-j@test.local", password: "manager-password-10" });
    await signIn(manager.id);
    const client = await db.client.create({ data: { name: "Stays Active", status: "ACTIVE" } });

    await expect(deactivateClientAction(form({ clientId: client.id }))).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.client.findUniqueOrThrow({ where: { id: client.id } })).status).toBe("ACTIVE");
  });

  it("reactivating restores ACTIVE status and logs CLIENT_ACTIVATED", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-k@test.local", password: "manager-password-11" });
    await signIn(manager.id);
    const client = await db.client.create({ data: { name: "Come Back", status: "CHURNED" } });

    await activateClientAction(form({ clientId: client.id }));

    expect((await db.client.findUniqueOrThrow({ where: { id: client.id } })).status).toBe("ACTIVE");
    expect(await db.auditLog.count({ where: { action: "CLIENT_ACTIVATED" } })).toBe(1);
  });

  it("unauthorized: an EMPLOYEE (no clients.update) cannot reactivate a client", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-c@test.local", password: "employee-password-3" });
    await signIn(employee.id);
    const client = await db.client.create({ data: { name: "Stays Churned", status: "CHURNED" } });

    await expect(activateClientAction(form({ clientId: client.id }))).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.client.findUniqueOrThrow({ where: { id: client.id } })).status).toBe("CHURNED");
  });
});
