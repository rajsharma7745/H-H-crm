import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton pieces that mirror the real layout primitives.
 *
 * Each loading.tsx used to hand-roll its own arrangement of bars, and they had
 * drifted out of step with the pages they stand in for — the dashboard's
 * skeleton was even a different width from the dashboard, so the whole page
 * jumped sideways the moment data arrived. Building both from the same pieces
 * is what keeps them aligned.
 */

export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {withAction && <Skeleton className="h-8 w-28 shrink-0" />}
    </div>
  );
}

export function FilterBarSkeleton({ controls = 4 }: { controls?: number }) {
  return (
    <div className="mt-6 rounded-xl border bg-card p-3 shadow-xs sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
        {Array.from({ length: controls - 1 }).map((_, i) => (
          <div key={i} className="space-y-1.5 lg:w-40">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-full lg:w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} size="sm">
          <CardContent className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="size-8 rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CardSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

/** Stands in for the list tables, which share one shape across the app. */
export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="hidden h-3 w-36 lg:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Stands in for a three-column pipeline board. */
export function BoardSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, col) => (
        <div key={col} className="rounded-xl border border-t-2 bg-muted/40">
          <div className="space-y-2 border-b px-3 py-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-7 rounded-md" />
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="space-y-2 p-2">
            {Array.from({ length: cards }).map((_, card) => (
              <Skeleton key={card} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
