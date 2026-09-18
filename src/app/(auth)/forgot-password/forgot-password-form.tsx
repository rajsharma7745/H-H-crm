"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    requestPasswordResetAction,
    undefined,
  );

  if (state?.success) {
    return (
      <Alert>
        <CheckCircle2 className="size-4" />
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@hhagency.com"
          required
          autoFocus
        />
      </div>

      <SubmitButton className="w-full" pendingText="Sending link...">
        Send reset link
      </SubmitButton>
    </form>
  );
}
