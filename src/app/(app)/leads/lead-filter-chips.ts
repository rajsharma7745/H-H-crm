import type { ActiveFilter } from "@/components/active-filters";
import { PIPELINE_LABEL, STAGE_LABEL } from "@/app/(app)/leads/lead-stage-badge";
import type { LeadStage } from "@prisma/client";

type Rep = { id: string; firstName: string; lastName: string };

export type LeadFilterParams = {
  q?: string;
  pipeline?: string;
  stage?: string;
  source?: string;
  assignedRep?: string;
};

/** Every query-string key the lead filters own — what "Clear all" clears. */
export const LEAD_FILTER_KEYS = ["q", "pipeline", "stage", "source", "assignedRep"] as const;

/**
 * Turns the raw query string into the chips shown above a lead list.
 *
 * Built on the server precisely so each chip can read "Representative: Priya
 * Nair" and "Stage: Proposal Sent" instead of leaking the cuid and the enum
 * value that are actually in the URL.
 */
export function buildLeadFilterChips(params: LeadFilterParams, reps: Rep[]): ActiveFilter[] {
  const chips: ActiveFilter[] = [];

  if (params.q) chips.push({ key: "q", label: "Search", display: params.q });
  if (params.pipeline && params.pipeline in PIPELINE_LABEL) {
    chips.push({
      key: "pipeline",
      label: "Pipeline",
      display: PIPELINE_LABEL[params.pipeline as keyof typeof PIPELINE_LABEL],
    });
  }
  if (params.stage && params.stage in STAGE_LABEL) {
    chips.push({ key: "stage", label: "Stage", display: STAGE_LABEL[params.stage as LeadStage] });
  }
  if (params.source) chips.push({ key: "source", label: "Source", display: params.source });
  if (params.assignedRep) {
    const rep = reps.find((r) => r.id === params.assignedRep);
    chips.push({
      key: "assignedRep",
      label: "Representative",
      display: rep ? `${rep.firstName} ${rep.lastName}` : "Selected person",
    });
  }

  return chips;
}
