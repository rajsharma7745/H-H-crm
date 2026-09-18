"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type ActionState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {nextPath && <input type="hidden" name="next" value={nextPath} />}

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

      <PasswordInput
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        labelExtra={
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        }
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox name="rememberMe" />
        Keep me signed in on this device
      </label>

      <SubmitButton className="w-full" pendingText="Signing in...">
        Sign in
      </SubmitButton>
    </form>
  );
}
