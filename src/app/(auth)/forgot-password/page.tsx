import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { BrandPanel } from "@/components/brand-panel";
import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh">
      <BrandPanel />

      <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Forgot your password?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter the email on your account and we&apos;ll send you a reset link.
          </p>

          <div className="mt-8">
            <ForgotPasswordForm />
          </div>

          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
