"use server";

import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createSession,
  getCurrentUser,
  invalidateAllSessionsForUser,
  invalidateCurrentSession,
} from "@/lib/session";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendMail, passwordResetEmail } from "@/lib/mailer";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validation";
import { headers } from "next/headers";

export type ActionState = { error?: string; success?: string } | undefined;

const GENERIC_LOGIN_ERROR = "Invalid email or password.";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password, rememberMe } = parsed.data;
  const ip = await getClientIp();

  const rate = checkRateLimit(`login:${ip}:${email}`, { limit: 8, windowMs: 10 * 60 * 1000 });
  if (!rate.allowed) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const user = await db.user.findUnique({ where: { email } });

  // Same generic error whether the account doesn't exist, the password is
  // wrong, or the account is inactive — never let a failed login reveal
  // which of those it was.
  if (!user || user.status !== "ACTIVE") {
    await logAuditEvent({ action: "LOGIN_FAILED", metadata: { email } });
    return { error: GENERIC_LOGIN_ERROR };
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    await logAuditEvent({ action: "LOGIN_FAILED", actorId: user.id, metadata: { email } });
    return { error: GENERIC_LOGIN_ERROR };
  }

  await createSession(user.id, rememberMe);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAuditEvent({ action: "LOGIN_SUCCESS", actorId: user.id });

  const next = formData.get("next");
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(safeNext);
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await invalidateCurrentSession();
  if (user) {
    await logAuditEvent({ action: "LOGOUT", actorId: user.id });
  }
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email } = parsed.data;
  const ip = await getClientIp();

  const rate = checkRateLimit(`reset:${ip}:${email}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  const genericSuccess = {
    success: "If an account exists for that email, we've sent a password reset link.",
  };
  if (!rate.allowed) return genericSuccess;

  const user = await db.user.findUnique({ where: { email } });

  // Deliberately identical response whether or not the account exists —
  // never reveal account existence through this endpoint.
  if (user && user.status === "ACTIVE") {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/reset-password/${rawToken}`;
    const { subject, html, text } = passwordResetEmail({ firstName: user.firstName, resetUrl });
    await sendMail({ to: user.email, subject, html, text });
    await logAuditEvent({ action: "PASSWORD_RESET_REQUESTED", actorId: user.id });
  }

  return genericSuccess;
}

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  const invalid =
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt.getTime() <= Date.now() ||
    resetToken.user.status !== "ACTIVE";

  if (invalid) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await hashPassword(password);

  await db.$transaction([
    db.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  // A password reset should end every existing session, not just issue a
  // new password while old sessions (possibly the attacker's) live on.
  await invalidateAllSessionsForUser(resetToken.userId);
  await logAuditEvent({ action: "PASSWORD_RESET_COMPLETED", actorId: resetToken.userId });

  redirect("/login?reset=success");
}
