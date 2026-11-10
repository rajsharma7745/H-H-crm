import type { Prisma, LeadPipeline, LeadStage } from "@prisma/client";
import { STAGES_BY_PIPELINE } from "@/lib/validation";
import { escapeLikeWildcards } from "@/lib/queries/search";

/**
 * Pure filter-building logic for the lead list — mirrors
 * src/lib/queries/clients.ts so search/pipeline/stage/source/rep filtering
 * can be unit tested without rendering.
 */

const VALID_PIPELINES: readonly LeadPipeline[] = ["ADS", "WARM_APPROACH"];
const ALL_STAGES: readonly LeadStage[] = [
  ...STAGES_BY_PIPELINE.ADS,
  ...STAGES_BY_PIPELINE.WARM_APPROACH,
] as LeadStage[];

export function parseLeadPipelineFilter(pipeline: string | undefined): LeadPipeline | undefined {
  return VALID_PIPELINES.includes(pipeline as LeadPipeline) ? (pipeline as LeadPipeline) : undefined;
}

export function parseLeadStageFilter(stage: string | undefined): LeadStage | undefined {
  return ALL_STAGES.includes(stage as LeadStage) ? (stage as LeadStage) : undefined;
}

export function buildLeadWhere(params: {
  q?: string;
  pipeline?: string;
  stage?: string;
  source?: string;
  assignedRep?: string;
}): Prisma.LeadWhereInput {
  const pipeline = parseLeadPipelineFilter(params.pipeline);
  const stage = parseLeadStageFilter(params.stage);
  const q = params.q ? escapeLikeWildcards(params.q) : params.q;

  return {
    ...(pipeline ? { pipeline } : {}),
    ...(stage ? { stage } : {}),
    ...(params.source ? { source: params.source } : {}),
    ...(params.assignedRep ? { assignedRepId: params.assignedRep } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { companyName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
