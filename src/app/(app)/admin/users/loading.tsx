import { PageShell } from "@/components/page-shell";
import { FilterBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function TeamLoading() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <FilterBarSkeleton controls={3} />
      <TableSkeleton className="mt-4" rows={5} />
    </PageShell>
  );
}
