import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";
import { RedirectSignal } from "../mocks/next-navigation";

vi.mock("next/headers", () => import("../mocks/next-headers"));
vi.mock("next/navigation", () => import("../mocks/next-navigation"));

const mailState = vi.hoisted(() => ({
  lastMail: null as null | { to: string; subject: string; html: string; text: string },
}));
vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();
  return {
    ...actual,
    sendMail: vi.fn(async (params: { to: string; subject: string; html: string; text: string }) => {
      mailState.lastMail = params;
    }),
  };
});

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { loginAction, logoutAction, requestPasswordResetAction, resetPasswordAction } from "@/lib/actions/auth";

let roleIds: Record<string, string>;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeAll(async () => {
  roleIds = await seedRolesAndPermissions();
}, 30_000);

afterEach(async () => {
  await truncateDynamicTables();
  headerMocks.__reset();
  mailState.lastMail = null;
});

describe("loginAction", () => {
  it("succeeds with correct credentials: creates a session, updates lastLoginAt, logs LOGIN_SUCCESS, redirects to /dashboard", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "login-ok@test.local", password: "correct-horse-11" });

    await expect(
      loginAction(undefined, form({ email: user.email, password: "correct-horse-11" })),
    ).rejects.toMatchObject({ url: "/dashboard" });

    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.lastLoginAt).not.toBeNull();
    const logs = await db.auditLog.findMany({ where: { actorId: user.id, action: "LOGIN_SUCCESS" } });
    expect(logs).toHaveLength(1);
  });

  it("honors a safe `next` redirect target instead of the default /dashboard", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "login-next@test.local", password: "correct-horse-12" });
    await expect(
      loginAction(undefined, form({ email: user.email, password: "correct-horse-12", next: "/admin/users" })),
    ).rejects.toMatchObject({ url: "/admin/users" });
  });

  it("ignores an unsafe (protocol-relative) `next` target and falls back to /dashboard", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "login-openredirect@test.local", password: "correct-horse-13" });
    await expect(
      loginAction(undefined, form({ email: user.email, password: "correct-horse-13", next: "//evil.example.com" })),
    ).rejects.toMatchObject({ url: "/dashboard" });
  });

  it("rejects a wrong password with the generic error and logs LOGIN_FAILED, no session created", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "login-badpw@test.local", password: "correct-horse-14" });

    const result = await loginAction(undefined, form({ email: user.email, password: "totally-wrong-pw" }));
    expect(result?.error).toBe("Invalid email or password.");
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { actorId: user.id, action: "LOGIN_FAILED" } })).toBe(1);
  });

  it("rejects an unknown email with the exact same generic error (no account-enumeration signal)", async () => {
    const result = await loginAction(undefined, form({ email: "nobody@test.local", password: "whatever12" }));
    expect(result?.error).toBe("Invalid email or password.");
  });

  it("inactive users cannot authenticate: correct password on a deactivated account is rejected, no session created", async () => {
    const user = await createTestUser({
      roleId: roleIds.EMPLOYEE,
      email: "login-inactive@test.local",
      password: "correct-horse-15",
      status: "INACTIVE",
    });

    const result = await loginAction(undefined, form({ email: user.email, password: "correct-horse-15" }));
    expect(result?.error).toBe("Invalid email or password.");
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("rate-limits repeated failed attempts for the same email", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "login-ratelimit@test.local", password: "correct-horse-16" });

    let lastResult;
    for (let i = 0; i < 9; i++) {
      lastResult = await loginAction(undefined, form({ email: user.email, password: "wrong-every-time" }));
    }
    expect(lastResult?.error).toMatch(/too many attempts/i);
  });
});

describe("logoutAction", () => {
  it("deletes the session row and redirects to /login", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "logout-ok@test.local", password: "correct-horse-17" });
    await createSession(user.id, false);

    await expect(logoutAction()).rejects.toBeInstanceOf(RedirectSignal);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(headerMocks.__getCookieValue("hhcrm_session")).toBeUndefined();
  });
});

describe("requestPasswordResetAction / resetPasswordAction", () => {
  it("issues a single-use reset link for an active account and emails it", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "reset-ok@test.local", password: "correct-horse-18" });

    const result = await requestPasswordResetAction(undefined, form({ email: user.email }));
    expect(result?.success).toMatch(/if an account exists/i);
    expect(await db.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);
    expect(mailState.lastMail?.to).toBe(user.email);
  });

  it("gives the identical generic response for an unknown email and creates no token (no enumeration)", async () => {
    const result = await requestPasswordResetAction(undefined, form({ email: "ghost@test.local" }));
    expect(result?.success).toMatch(/if an account exists/i);
    expect(mailState.lastMail).toBeNull();
  });

  it("completes a reset with a valid token: updates the password, invalidates every existing session, single-use enforced", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "reset-complete@test.local", password: "old-password-1" });
    await createSession(user.id, false); // a session that must die on reset

    await requestPasswordResetAction(undefined, form({ email: user.email }));
    const rawToken = mailState.lastMail!.text.match(/reset-password\/([a-f0-9]+)/)?.[1];
    expect(rawToken).toBeTruthy();

    await expect(
      resetPasswordAction(
        undefined,
        form({ token: rawToken!, password: "brand-new-password-1", confirmPassword: "brand-new-password-1" }),
      ),
    ).rejects.toMatchObject({ url: "/login?reset=success" });

    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);

    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("brand-new-password-1", refreshed.passwordHash)).toBe(true);

    // Reusing the same (now-consumed) token must fail.
    const reuse = await resetPasswordAction(
      undefined,
      form({ token: rawToken!, password: "another-password-1", confirmPassword: "another-password-1" }),
    );
    expect(reuse?.error).toMatch(/invalid or has expired/i);
  });

  it("rejects an expired token", async () => {
    const user = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "reset-expired@test.local", password: "old-password-2" });
    await requestPasswordResetAction(undefined, form({ email: user.email }));
    const rawToken = mailState.lastMail!.text.match(/reset-password\/([a-f0-9]+)/)?.[1];
    if (!rawToken) throw new Error("reset email did not contain a token");

    await db.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await resetPasswordAction(
      undefined,
      form({ token: rawToken, password: "brand-new-password-2", confirmPassword: "brand-new-password-2" }),
    );
    expect(result?.error).toMatch(/invalid or has expired/i);
  });

  it("rejects a bogus token", async () => {
    const result = await resetPasswordAction(
      undefined,
      form({ token: "not-a-real-token", password: "brand-new-password-3", confirmPassword: "brand-new-password-3" }),
    );
    expect(result?.error).toMatch(/invalid or has expired/i);
  });
});
