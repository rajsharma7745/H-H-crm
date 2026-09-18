import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Not authorized" };

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="size-7" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your account role doesn&apos;t include permission to view this. If you think that&apos;s
        wrong, ask an administrator to update your access.
      </p>
      <Button
        className="mt-2"
        nativeButton={false}
        render={<Link href="/dashboard">Back to dashboard</Link>}
      />
    </div>
  );
}
