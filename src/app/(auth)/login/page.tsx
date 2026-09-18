import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandPanel } from "@/components/brand-panel";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { QueryToast } from "@/components/query-toast";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-svh">
      <BrandPanel />

      <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Suspense fallback={null}>
            <QueryToast
              param="reset"
              messages={{
                success: { type: "success", text: "Password reset. Sign in with your new password." },
              }}
            />
            <QueryToast
              param="passwordChanged"
              messages={{
                success: { type: "success", text: "Password changed. Please sign in again." },
              }}
            />
          </Suspense>

          <div className="mb-8 lg:hidden">
            <div className="mb-6 flex size-9 items-center justify-center rounded-lg bg-neutral-950 text-sm font-bold tracking-tight text-white">
              H&H
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to your H&H CRM account to continue.
          </p>

          <div className="mt-8">
            <LoginForm nextPath={next} />
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            Trouble signing in? Contact your account administrator.{" "}
            <Link href="/forgot-password" className="underline underline-offset-2">
              Reset your password
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
