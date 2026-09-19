import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";

vi.mock("next/headers", () => import("../mocks/next-headers"));

import { db } from "@/lib/db";
import {
  createSession,
  invalidateAllSessionsForUser,
  invalidateCurrentSession,
  validateSessionToken,
} from "@/lib/session";

let roleIds: Record<string, string>;

beforeAll(async () => {
  roleIds = await seedRolesAndPermissions();
}, 30_000);

afterEach(async () => {
  await truncateDynamicTables();
  headerMocks.__reset();
});

describe("createSession / validateSessionToken", () => {
  it("creates a database-backed session and sets an httpOnly cookie with only the token's hash stored", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "session-a@test.local", password: "correct-horse-1" });

    const { token } = await createSession(user.id, false);
    const cookieValue = headerMocks.__getCookieValue("hhcrm_session");
    expect(cookieValue).toBe(token);

    const rows = await db.session.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token); // only the hash is persisted, never the raw token
  });

  it("resolves the user for a valid, unexpired token", async () => {
    const user = await createTestUser({ roleId: roleIds.MANAGER, email: "session-b@test.local", password: "correct-horse-2" });
    const { token } = await createSession(user.id, false);

    const resolved = await validateSessionToken(token);
    expect(resolved?.id).toBe(user.id);
    expect(resolved?.role.key).toBe("MANAGER");
  });

  it("returns null for a token that was never issued", async () => {
    const resolved = await validateSessionToken("not-a-real-token");
    expect(resolved).toBeNull();
  });

  it("rejects and deletes an expired session", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "session-c@test.local", password: "correct-horse-3" });
    const { token } = await createSession(user.id, false);

    // Force it into the past directly in the DB, simulating time passing.
    await db.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const resolved = await validateSessionToken(token);
    expect(resolved).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("inactive users cannot authenticate — a deactivated user's existing session is rejected and pruned", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "session-d@test.local", password: "correct-horse-4" });
    const { token } = await createSession(user.id, false);

    await db.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } });

    const resolved = await validateSessionToken(token);
    expect(resolved).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("invalidateCurrentSession / invalidateAllSessionsForUser", () => {
  it("invalidateCurrentSession deletes only the session named by the current cookie", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "session-e@test.local", password: "correct-horse-5" });
    await createSession(user.id, false);

    await invalidateCurrentSession();

    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(headerMocks.__getCookieValue("hhcrm_session")).toBeUndefined();
  });

  it("invalidateAllSessionsForUser removes every session for that user but leaves other users' sessions alone", async () => {
    const userA = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "session-f@test.local", password: "correct-horse-6" });
    const userB = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "session-g@test.local", password: "correct-horse-7" });

    await createSession(userA.id, false);
    await createSession(userA.id, true); // a second device/session for the same user
    await createSession(userB.id, false);

    await invalidateAllSessionsForUser(userA.id);

    expect(await db.session.count({ where: { userId: userA.id } })).toBe(0);
    expect(await db.session.count({ where: { userId: userB.id } })).toBe(1);
  });
});
