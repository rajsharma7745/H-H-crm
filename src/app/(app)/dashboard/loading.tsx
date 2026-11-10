import { PageShell } from "@/components/page-shell";
import { CardSkeleton, PageHeaderSkeleton, StatGridSkeleton } from "@/components/skeletons";
import { Separator } from "@/components/ui/separator";

export default function DashboardLoading() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <StatGridSkeleton count={8} />
      <Separator className="my-8" />
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton rows={3} />
        <CardSkeleton rows={3} />
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <CardSkeleton rows={2} />
        <CardSkeleton rows={4} />
      </div>
    </PageShell>
  );
}
