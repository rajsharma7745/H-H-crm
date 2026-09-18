import "server-only";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "hhcrm_session";

// Absolute DB-side expiry. "Remember me" sessions live longer than the
// default browser-session-only login, so a stolen/restored cookie from a
// non-remembered login still dies quickly server-side.
const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

export type AuthenticatedUser = Prisma.UserGetPayload<{
  include: {
    role: {
      include: {
        permissions: { include: { permission: true } };
      };
    };
  };
}>;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function getRequestMeta() {
  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent") || null;
  return { ipAddress, userAgent };
}

/**
 * Creates a new database-backed session for a user and sets the httpOnly
 * session cookie on the response. Call after credentials have already been
 * verified.
 */
export async function createSession(userId: string, rememberMe: boolean) {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const durationMs = rememberMe ? REMEMBER_ME_DURATION_MS : DEFAULT_SESSION_DURATION_MS;
  const expiresAt = new Date(Date.now() + durationMs);
  const { ipAddress, userAgent } = await getRequestMeta();

  await db.session.create({
    data: { userId, tokenHash, expiresAt, ipAddress, userAgent },
  });

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Omitting maxAge makes it a browser-session cookie; the DB-side
    // expiresAt above is the real security boundary either way.
    ...(rememberMe ? { maxAge: Math.floor(durationMs / 1000) } : {}),
  });

  return { token, expiresAt };
}

/** Reads the raw session token from the incoming request's cookies, if any. */
export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/** Clears the session cookie on the response (does not touch the DB row). */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Validates a raw session token against the database: the session must
 * exist, be unexpired, and belong to an ACTIVE user. Expired sessions and
 * sessions for inactive/deleted users are pruned as they're encountered.
 */
export async function validateSessionToken(
  token: string,
): Promise<AuthenticatedUser | null> {
  const tokenHash = hashToken(token);

  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (session.user.status !== "ACTIVE") {
    // Inactive users must not be able to use an existing session either.
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

/** Deletes the current session row (logout). Safe to call if none exists. */
export async function invalidateCurrentSession() {
  const token = await getSessionTokenFromCookie();
  if (!token) return;
  const tokenHash = hashToken(token);
  await db.session.deleteMany({ where: { tokenHash } });
  await clearSessionCookie();
}

/**
 * Deletes every session for a user — used on password change, deactivation
 * and role change so a compromised or stale session can't outlive the event
 * that should have ended it.
 */
export async function invalidateAllSessionsForUser(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/**
 * Resolves the current request's authenticated user, if any. Memoized per
 * request via React's `cache()` so multiple server components/actions in the
 * same render don't each hit the database.
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const token = await getSessionTokenFromCookie();
  if (!token) return null;
  return validateSessionToken(token);
});
