import { PageShell } from "@/components/page-shell";
import { CardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function SettingsLoading() {
  return (
    <PageShell width="narrow">
      <PageHeaderSkeleton withAction={false} />
      <div className="mt-8 space-y-4">
        <CardSkeleton rows={2} />
        <CardSkeleton rows={4} />
        <CardSkeleton rows={3} />
      </div>
    </PageShell>
  );
}
