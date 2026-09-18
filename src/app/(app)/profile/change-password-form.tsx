"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions/profile";
import type { ActionState } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    changePasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid gap-5">
      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <PasswordInput label="Current password" name="currentPassword" autoComplete="current-password" required />
      <PasswordInput label="New password" name="newPassword" autoComplete="new-password" required />
      <PasswordInput
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        required
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        At least 10 characters, with a letter and a number or symbol. You&apos;ll be signed out
        everywhere and need to sign in again.
      </p>

      <div>
        <SubmitButton pendingText="Changing password...">Change password</SubmitButton>
      </div>
    </form>
  );
}
