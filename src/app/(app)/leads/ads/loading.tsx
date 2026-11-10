import { PageShell } from "@/components/page-shell";
import { BoardSkeleton, FilterBarSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function AdsPipelineLoading() {
  return (
    <PageShell width="wide">
      <PageHeaderSkeleton />
      <FilterBarSkeleton controls={3} />
      <div className="mt-4">
        <BoardSkeleton />
      </div>
    </PageShell>
  );
}
