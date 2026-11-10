import { PageShell } from "@/components/page-shell";
import { FilterBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function LeadsLoading() {
  return (
    <PageShell width="wide">
      <PageHeaderSkeleton />
      <FilterBarSkeleton controls={5} />
      <TableSkeleton className="mt-4" rows={6} />
    </PageShell>
  );
}
