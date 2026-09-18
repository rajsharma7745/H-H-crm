import "server-only";

/**
 * Mailer abstraction. Phase 1 only needs the password-reset email, and no
 * transactional email provider has been chosen yet, so this logs to the
 * console in development and throws clearly in production until a real
 * provider (Resend/SES/Postmark/etc.) is wired in here.
 *
 * Swap the body of `sendMail` when a provider is chosen — nothing that
 * calls `sendMail` needs to change.
 */
export async function sendMail(params: { to: string; subject: string; html: string; text: string }) {
  if (process.env.NODE_ENV !== "production") {
    console.log("\n--- sendMail (dev stub, not actually sent) ---");
    console.log("To:", params.to);
    console.log("Subject:", params.subject);
    console.log(params.text);
    console.log("--- end sendMail ---\n");
    return;
  }

  throw new Error(
    "No email provider is configured. Wire a real provider into src/lib/mailer.ts before relying on password-reset emails in production.",
  );
}

export function passwordResetEmail(params: { firstName: string; resetUrl: string }) {
  const { firstName, resetUrl } = params;
  return {
    subject: "Reset your H&H CRM password",
    text: `Hi ${firstName},\n\nA password reset was requested for your H&H CRM account. This link expires in 1 hour and can only be used once:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>Hi ${firstName},</p><p>A password reset was requested for your H&H CRM account. This link expires in 1 hour and can only be used once:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  };
}
