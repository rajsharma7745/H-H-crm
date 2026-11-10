import { PageShell } from "@/components/page-shell";
import { CardSkeleton, FilterBarSkeleton, PageHeaderSkeleton, StatGridSkeleton } from "@/components/skeletons";

/**
 * Reports runs ten aggregate queries, so it is the page most likely to be
 * waiting on the database — and the one that previously showed nothing at all
 * while it did.
 */
export default function ReportsLoading() {
  return (
    <PageShell width="wide">
      <PageHeaderSkeleton />
      <FilterBarSkeleton controls={3} />
      <StatGridSkeleton count={4} />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
      </div>
      <CardSkeleton className="mt-4" rows={4} />
    </PageShell>
  );
}
