import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LeadStage } from "@prisma/client";

export const STAGE_LABEL: Record<LeadStage, string> = {
  COLD: "Cold",
  WARM: "Warm",
  HOT: "Hot",
  PLAN_MEET: "Plan Meet",
  PITCHED: "Pitched",
  PROPOSAL_SENT: "Proposal Sent",
};

/**
 * Every stage now has its own hue, drawn from the stage tokens in globals.css:
 * the Ads stages run as a temperature ramp (cool blue → amber → hot red) and
 * the Warm Approach stages as a progression (violet → blue → green).
 *
 * Previously all six shared three generic badge variants, so "Hot", "Proposal
 * Sent" and a Completed follow-up were all the same solid black pill and the
 * only way to tell any status apart was to stop and read it. Colour is an
 * accelerator here, never the sole signal — the label is always present.
 */
export const STAGE_CLASS: Record<LeadStage, string> = {
  COLD: "bg-stage-cold/10 text-stage-cold dark:bg-stage-cold/15",
  WARM: "bg-stage-warm/10 text-stage-warm dark:bg-stage-warm/15",
  HOT: "bg-stage-hot/10 text-stage-hot dark:bg-stage-hot/15",
  PLAN_MEET: "bg-stage-plan-meet/10 text-stage-plan-meet dark:bg-stage-plan-meet/15",
  PITCHED: "bg-stage-pitched/10 text-stage-pitched dark:bg-stage-pitched/15",
  PROPOSAL_SENT: "bg-stage-proposal-sent/10 text-stage-proposal-sent dark:bg-stage-proposal-sent/15",
};

/** Solid version of each stage hue, for column headers and progress bars. */
export const STAGE_DOT_CLASS: Record<LeadStage, string> = {
  COLD: "bg-stage-cold",
  WARM: "bg-stage-warm",
  HOT: "bg-stage-hot",
  PLAN_MEET: "bg-stage-plan-meet",
  PITCHED: "bg-stage-pitched",
  PROPOSAL_SENT: "bg-stage-proposal-sent",
};

export function LeadStageBadge({ stage, className }: { stage: LeadStage; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STAGE_CLASS[stage], className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", STAGE_DOT_CLASS[stage])} aria-hidden="true" />
      {STAGE_LABEL[stage]}
    </Badge>
  );
}

export const PIPELINE_LABEL: Record<"ADS" | "WARM_APPROACH", string> = {
  ADS: "Ads",
  WARM_APPROACH: "Warm Approach",
};

/** Which pipeline a lead belongs to — deliberately neutral, so it never
 * competes with the stage badge sitting next to it. */
export function PipelineBadge({ pipeline }: { pipeline: "ADS" | "WARM_APPROACH" }) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {PIPELINE_LABEL[pipeline]}
    </Badge>
  );
}
