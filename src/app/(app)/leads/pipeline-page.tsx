import { Suspense } from "react";
import { Plus, SearchX, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission, userHasPermission } from "@/lib/rbac/authorize";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/empty-state";
import { ActiveFilters } from "@/components/active-filters";
import { FilterBar, PageHeader, PageShell, ResultCount } from "@/components/page-shell";
import { LeadFilters } from "@/app/(app)/leads/lead-filters";
import { LeadDialog } from "@/app/(app)/leads/lead-dialog";
import { PipelineBoard, type PipelineStageOption } from "@/app/(app)/leads/pipeline-board";
import { buildLeadFilterChips, LEAD_FILTER_KEYS } from "@/app/(app)/leads/lead-filter-chips";
import { buildLeadWhere } from "@/lib/queries/leads";
import { serializeLead } from "@/lib/queries/serialize-lead";
import type { LeadListRow } from "@/app/(app)/leads/lead-list";
import type { LeadPipeline } from "@prisma/client";

export type PipelinePageSearchParams = { q?: string; source?: string; assignedRep?: string };

/**
 * The body both pipeline routes render.
 *
 * /leads/ads and /leads/warm-approach were two ~110-line files that differed
 * only in their labels, their stage list and one enum. Sharing the body is how
 * "make the Warm Approach board visually consistent with the Ads board" stays
 * true after the next change to either one, rather than being true only today.
 */
export async function PipelinePage({
  pipeline,
  title,
  description,
  emptyIcon,
  emptyTitle,
  stages,
  searchParams,
}: {
  pipeline: LeadPipeline;
  title: string;
  description: React.ReactNode;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  stages: PipelineStageOption[];
  searchParams: Promise<PipelinePageSearchParams>;
}) {
  const currentUser = await requirePermission("leads.view");
  const { q, source, assignedRep } = await searchParams;

  const canCreate = userHasPermission(currentUser, "leads.create");
  const canUpdate = userHasPermission(currentUser, "leads.update");
  const canDelete = userHasPermission(currentUser, "leads.delete");

  const where = { ...buildLeadWhere({ q, source, assignedRep }), pipeline };

  const [leads, reps, totalInPipeline] = await Promise.all([
    db.lead.findMany({
      where,
      include: { assignedRep: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.lead.count({ where: { pipeline } }),
  ]);

  const leadsByStage: Record<string, LeadListRow[]> = Object.fromEntries(
    stages.map((stage) => [stage.value, [] as LeadListRow[]]),
  );
  for (const lead of leads.map(serializeLead)) {
    leadsByStage[lead.stage]?.push(lead);
  }

  const chips = buildLeadFilterChips({ q, source, assignedRep }, reps);

  const addLeadButton = (
    <LeadDialog
      reps={reps}
      defaultPipeline={pipeline}
      trigger={
        <Button>
          <Plus className="size-4" />
          Add lead
        </Button>
      }
    />
  );

  return (
    <PageShell width="wide">
      <PageHeader title={title} description={description} actions={canCreate ? addLeadButton : undefined} />

      {totalInPipeline > 0 && (
        <FilterBar className="mt-6">
          <Suspense fallback={null}>
            <LeadFilters reps={reps} showPipelineAndStage={false} />
          </Suspense>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Suspense fallback={null}>
              <ActiveFilters filters={chips} alsoClear={[...LEAD_FILTER_KEYS]} />
            </Suspense>
            <ResultCount shown={leads.length} total={totalInPipeline} noun="lead" />
          </div>
        </FilterBar>
      )}

      <div className="mt-4">
        {totalInPipeline === 0 ? (
          <EmptyPanel
            icon={emptyIcon}
            title={emptyTitle}
            description={`Add your first lead to start building the ${title.replace(" Pipeline", "")} pipeline.`}
            action={canCreate ? addLeadButton : undefined}
          />
        ) : leads.length === 0 ? (
          <EmptyPanel
            icon={SearchX}
            title="No leads match your filters"
            description="Nothing in this pipeline matches what you are filtering by. Remove a filter above to see more."
          />
        ) : (
          <PipelineBoard
            stages={stages}
            leadsByStage={leadsByStage}
            reps={reps}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        )}
      </div>
    </PageShell>
  );
}
