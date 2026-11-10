"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared fallback UI for route-segment error.tsx boundaries.
 *
 * Deliberately says nothing technical: the real error, its digest and its
 * stack are already logged (by the boundary, and by Next on the server), which
 * is where they are useful. What the person in front of the screen needs is to
 * know it is not their fault and to have two ways out.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "This page couldn't be loaded. Trying again usually fixes it — if it keeps happening, let an administrator know.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button onClick={onRetry}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
        )}
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <Link href="/dashboard">
              <LayoutDashboard className="size-4" />
              Back to dashboard
            </Link>
          }
        />
      </div>
    </div>
  );
}
