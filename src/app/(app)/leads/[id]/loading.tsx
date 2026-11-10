import { PageShell } from "@/components/page-shell";
import { CardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeadDetailLoading() {
  return (
    <PageShell>
      <Skeleton className="h-4 w-24" />
      <div className="mt-4">
        <PageHeaderSkeleton />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <CardSkeleton className="lg:col-span-2" rows={4} />
        <CardSkeleton rows={2} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <CardSkeleton className="lg:col-span-2" rows={5} />
        <CardSkeleton rows={3} />
      </div>
      <CardSkeleton className="mt-4" rows={4} />
    </PageShell>
  );
}
