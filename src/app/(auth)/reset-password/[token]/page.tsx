import type { Metadata } from "next";
import { BrandPanel } from "@/components/brand-panel";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/[token]/reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex min-h-svh">
      <BrandPanel />

      <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Set a new password</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choose a strong password you haven&apos;t used before.
          </p>

          <div className="mt-8">
            <ResetPasswordForm token={token} />
          </div>
        </div>
      </div>
    </div>
  );
}
