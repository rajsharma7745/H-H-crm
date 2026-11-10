import type { Metadata } from "next";
import { Suspense } from "react";
import { Target, Plus, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission, userHasPermission } from "@/lib/rbac/authorize";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/empty-state";
import { ActiveFilters } from "@/components/active-filters";
import { FilterBar, PageHeader, PageShell, ResultCount } from "@/components/page-shell";
import { LeadFilters } from "@/app/(app)/leads/lead-filters";
import { LeadDialog } from "@/app/(app)/leads/lead-dialog";
import { LeadList } from "@/app/(app)/leads/lead-list";
import { buildLeadFilterChips, LEAD_FILTER_KEYS } from "@/app/(app)/leads/lead-filter-chips";
import { buildLeadWhere } from "@/lib/queries/leads";
import { serializeLead } from "@/lib/queries/serialize-lead";

export const metadata: Metadata = { title: "All Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pipeline?: string; stage?: string; source?: string; assignedRep?: string }>;
}) {
  const currentUser = await requirePermission("leads.view");
  const params = await searchParams;
  const { q, pipeline, stage, source, assignedRep } = params;

  const canCreate = userHasPermission(currentUser, "leads.create");
  const canUpdate = userHasPermission(currentUser, "leads.update");
  const canDelete = userHasPermission(currentUser, "leads.delete");

  const now = new Date();
  const where = buildLeadWhere({ q, pipeline, stage, source, assignedRep });

  const [leads, reps, totalLeadCount] = await Promise.all([
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
    db.lead.count(),
  ]);

  const chips = buildLeadFilterChips(params, reps);

  const addLeadButton = (
    <LeadDialog
      reps={reps}
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
      <PageHeader
        title="All Leads"
        description="Every lead from both pipelines in one list. Search for someone, narrow the list with the filters, then open a lead to see its full history."
        actions={canCreate ? addLeadButton : undefined}
      />

      {totalLeadCount > 0 && (
        <FilterBar className="mt-6">
          <Suspense fallback={null}>
            <LeadFilters reps={reps} />
          </Suspense>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Suspense fallback={null}>
              <ActiveFilters filters={chips} alsoClear={[...LEAD_FILTER_KEYS]} />
            </Suspense>
            <ResultCount shown={leads.length} total={totalLeadCount} noun="lead" />
          </div>
        </FilterBar>
      )}

      <div className="mt-4">
        {totalLeadCount === 0 ? (
          <EmptyPanel
            icon={Target}
            title="No leads yet"
            description="A lead is anyone who might become a client. Add your first one and it will appear here and on its pipeline board."
            action={canCreate ? addLeadButton : undefined}
          />
        ) : leads.length === 0 ? (
          <EmptyPanel
            icon={SearchX}
            title="No leads match your filters"
            description="Nothing matches everything you are filtering by at once. Remove a filter above, or clear them all, to see more leads."
          />
        ) : (
          <LeadList
            leads={leads.map(serializeLead)}
            reps={reps}
            canUpdate={canUpdate}
            canDelete={canDelete}
            now={now}
          />
        )}
      </div>
    </PageShell>
  );
}
