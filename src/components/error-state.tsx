"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared fallback UI for route-segment error.tsx boundaries. */
export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Try again, and if it keeps happening, let an administrator know.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button className="mt-1" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
