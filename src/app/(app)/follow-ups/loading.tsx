import { PageShell } from "@/components/page-shell";
import { FilterBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function FollowUpsLoading() {
  return (
    <PageShell width="wide">
      <PageHeaderSkeleton />

      {/* The view switcher, so the tabs don't pop in after the page paints. */}
      <div className="mt-6 inline-flex gap-1 rounded-xl border bg-muted/60 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-3 h-4 w-72" />

      <FilterBarSkeleton controls={3} />
      <TableSkeleton className="mt-4" rows={6} />
    </PageShell>
  );
}
