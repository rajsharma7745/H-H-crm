import type { Metadata } from "next";
import { Handshake } from "lucide-react";
import { PipelinePage, type PipelinePageSearchParams } from "@/app/(app)/leads/pipeline-page";
import type { PipelineStageOption } from "@/app/(app)/leads/pipeline-board";

export const metadata: Metadata = { title: "Warm Approach Pipeline" };

const WARM_APPROACH_STAGES: PipelineStageOption[] = [
  { value: "PLAN_MEET", label: "Plan Meet", description: "Contact made — a meeting is being arranged." },
  { value: "PITCHED", label: "Pitched", description: "You have presented your offer; they are considering it." },
  {
    value: "PROPOSAL_SENT",
    label: "Proposal Sent",
    description: "A written proposal is with them, awaiting a decision.",
  },
];

export default async function WarmApproachPipelinePage({
  searchParams,
}: {
  searchParams: Promise<PipelinePageSearchParams>;
}) {
  return (
    <PipelinePage
      pipeline="WARM_APPROACH"
      title="Warm Approach Pipeline"
      description="Leads you approached directly rather than through advertising. They move left to right: Plan Meet, then Pitched, then Proposal Sent."
      emptyIcon={Handshake}
      emptyTitle="No Warm Approach leads yet"
      stages={WARM_APPROACH_STAGES}
      searchParams={searchParams}
    />
  );
}
