"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ActionState } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <PasswordInput label="New password" name="password" autoComplete="new-password" required />
      <PasswordInput
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        required
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        At least 10 characters, with a letter and a number or symbol.
      </p>

      <SubmitButton className="w-full" pendingText="Resetting...">
        Reset password
      </SubmitButton>
    </form>
  );
}
