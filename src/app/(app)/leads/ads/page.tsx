import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { PipelinePage, type PipelinePageSearchParams } from "@/app/(app)/leads/pipeline-page";
import type { PipelineStageOption } from "@/app/(app)/leads/pipeline-board";

export const metadata: Metadata = { title: "Ads Pipeline" };

const ADS_STAGES: PipelineStageOption[] = [
  { value: "COLD", label: "Cold", description: "New enquiries you have not qualified yet." },
  { value: "WARM", label: "Warm", description: "Responsive and interested — worth a real conversation." },
  { value: "HOT", label: "Hot", description: "Ready to buy, or very close to it." },
];

export default async function AdsPipelinePage({
  searchParams,
}: {
  searchParams: Promise<PipelinePageSearchParams>;
}) {
  return (
    <PipelinePage
      pipeline="ADS"
      title="Ads Pipeline"
      description="Leads that came in from advertising and lead-generation campaigns. They move left to right as they warm up: Cold, then Warm, then Hot."
      emptyIcon={Megaphone}
      emptyTitle="No Ads leads yet"
      stages={ADS_STAGES}
      searchParams={searchParams}
    />
  );
}
