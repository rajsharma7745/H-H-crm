import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, Inbox, Info, Target, Flame, FileText, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/authorize";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyPanel } from "@/components/empty-state";
import { FilterBar, PageHeader, PageSection, PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ReportFilters } from "@/app/(app)/reports/report-filters";
import { STAGE_DOT_CLASS, STAGE_LABEL } from "@/app/(app)/leads/lead-stage-badge";
import { resolveDateRange } from "@/lib/queries/date-range";
import { parseLeadPipelineFilter } from "@/lib/queries/leads";
import {
  getConversionReport,
  getLeadsByCampaign,
  getLeadsByPipeline,
  getLeadsBySource,
  getLeadsByStage,
  getLeadsCreatedOverTime,
  getStageAging,
  getStageMovements,
  getTeamPerformance,
  type CountRow,
  type ReportFilters as Filters,
} from "@/lib/queries/reports";
import type { LeadStage } from "@prisma/client";

export const metadata: Metadata = { title: "Reports" };

/** Stage names map back to their pipeline hue wherever they appear as a label. */
const STAGE_BAR_BY_LABEL: Record<string, string> = Object.fromEntries(
  (Object.keys(STAGE_LABEL) as LeadStage[]).map((stage) => [STAGE_LABEL[stage], STAGE_DOT_CLASS[stage]]),
);

/** Renders a rate as a percentage, or "—" when its denominator was 0. A rate
 * that can't be computed is never shown as 0%. */
function Rate({ value, denominatorNote }: { value: number | null; denominatorNote: string }) {
  if (value === null) {
    return (
      <span className="text-muted-foreground" title={`Not available — ${denominatorNote}`}>
        —
      </span>
    );
  }
  return <span>{Math.round(value * 1000) / 10}%</span>;
}

function CountTable({
  rows,
  labelHeader,
  countHeader = "Leads",
  emptyMessage,
  suffix,
  barClassByLabel,
  defaultBarClass = "bg-primary/70",
}: {
  rows: CountRow[];
  labelHeader: string;
  countHeader?: string;
  emptyMessage: string;
  suffix?: string;
  /** Per-label bar colour, so stage tables stay colour-consistent with badges. */
  barClassByLabel?: Record<string, string>;
  defaultBarClass?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const max = Math.max(...rows.map((row) => row.count), 0);

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-8 px-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {labelHeader}
          </TableHead>
          <TableHead className="h-8 w-20 px-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {countHeader}
          </TableHead>
          <TableHead className="h-8 w-28 px-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label} className="hover:bg-transparent">
            <TableCell className="max-w-56 truncate px-0 py-2 text-sm" title={row.label}>
              {row.label}
            </TableCell>
            <TableCell className="tabular-metric px-2 py-2 text-right text-sm font-medium">
              {row.count}
              {suffix ?? ""}
            </TableCell>
            <TableCell className="px-0 py-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", barClassByLabel?.[row.label] ?? defaultBarClass)}
                  style={{ width: max > 0 ? `${Math.round((row.count / max) * 100)}%` : "0%" }}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; pipeline?: string; assignedRep?: string }>;
}) {
  await requirePermission("reports.view");
  const params = await searchParams;

  // One `now` for the whole render so every number agrees.
  const now = new Date();
  const range = resolveDateRange(params, now);
  const pipeline = parseLeadPipelineFilter(params.pipeline);
  const assignedRepId = params.assignedRep || undefined;
  const filters: Filters = { range, pipeline, assignedRepId };

  const [
    reps,
    createdOverTime,
    bySource,
    byCampaign,
    byPipeline,
    byStage,
    stageAging,
    stageMovements,
    conversion,
    team,
  ] = await Promise.all([
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    getLeadsCreatedOverTime(filters),
    getLeadsBySource(filters),
    getLeadsByCampaign(filters),
    getLeadsByPipeline(filters),
    getLeadsByStage(filters),
    getStageAging(filters, now),
    getStageMovements(filters),
    getConversionReport(filters),
    getTeamPerformance(filters, now),
  ]);

  const exportQuery = new URLSearchParams();
  if (params.range) exportQuery.set("range", params.range);
  if (params.from) exportQuery.set("from", params.from);
  if (params.to) exportQuery.set("to", params.to);
  if (params.pipeline) exportQuery.set("pipeline", params.pipeline);
  if (params.assignedRep) exportQuery.set("assignedRep", params.assignedRep);

  return (
    <PageShell width="wide">
      <PageHeader
        title="Reports"
        description={
          <>
            How leads are performing for{" "}
            <span className="font-medium text-foreground">{range.label.toLowerCase()}</span>. Leads are counted by the
            date they were created. Adjust the range and filters below; the CSV export uses whatever you have selected.
          </>
        }
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a href={`/reports/export?${exportQuery.toString()}`} download>
                <Download className="size-4" />
                Export as CSV
              </a>
            }
          />
        }
      />

      <FilterBar className="mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <Suspense fallback={null}>
            <DateRangeFilter />
          </Suspense>
          <Suspense fallback={null}>
            <ReportFilters reps={reps} />
          </Suspense>
        </div>
      </FilterBar>

      {conversion.totalLeads === 0 ? (
        <EmptyPanel
          className="mt-6"
          icon={Inbox}
          title="No leads match these filters"
          description="Nothing was created in this date range for the pipeline and representative you selected. Try a wider date range, or switch back to both pipelines and everyone."
        />
      ) : (
        <>
          <PageSection
            className="mt-8"
            title="Conversion"
            description="Every rate below states its own denominator. A rate that cannot be computed shows a dash, never 0%."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Leads in scope"
                value={conversion.totalLeads}
                note="The denominator for the two rates beside it"
                icon={Target}
                tone="brand"
              />
              <StatCard
                label="Reached Hot"
                value={
                  <>
                    {conversion.reachedHot}
                    <span className="text-base font-medium text-muted-foreground">
                      {" · "}
                      <Rate value={conversion.hotRate} denominatorNote="no leads in scope" />
                    </span>
                  </>
                }
                note="Currently in Hot ÷ leads in scope"
                icon={Flame}
                tone="warning"
              />
              <StatCard
                label="Proposals sent"
                value={
                  <>
                    {conversion.proposalsSent}
                    <span className="text-base font-medium text-muted-foreground">
                      {" · "}
                      <Rate value={conversion.proposalRate} denominatorNote="no leads in scope" />
                    </span>
                  </>
                }
                note="In Proposal Sent ÷ leads in scope"
                icon={FileText}
                tone="brand"
              />
              <StatCard
                label="Win rate"
                value={<Rate value={conversion.winRate} denominatorNote="nothing won or lost yet" />}
                note={`${conversion.won} won ÷ ${conversion.decided} decided (won + lost)`}
                icon={Trophy}
                tone="success"
              />
            </div>
          </PageSection>

          <PageSection
            className="mt-8"
            title="Where leads come from"
            description="Volume over time and the channels producing it."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>New leads per day</CardTitle>
                  <CardDescription>Only days that had at least one new lead appear.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CountTable
                    rows={createdOverTime}
                    labelHeader="Day"
                    emptyMessage="No leads were created in this range."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By source</CardTitle>
                  <CardDescription>
                    Source is free text on each lead, so near-duplicates split the numbers.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CountTable rows={bySource} labelHeader="Source" emptyMessage="No leads in this range." />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By campaign</CardTitle>
                  <CardDescription>Campaign is only recorded on Ads leads.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CountTable
                    rows={byCampaign}
                    labelHeader="Campaign"
                    emptyMessage="No campaign data in this range."
                    defaultBarClass="bg-chart-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By pipeline</CardTitle>
                  <CardDescription>Both pipelines, unless you filtered to one above.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CountTable
                    rows={byPipeline}
                    labelHeader="Pipeline"
                    emptyMessage="No leads in this range."
                    barClassByLabel={{ Ads: "bg-chart-1", "Warm Approach": "bg-chart-3" }}
                  />
                </CardContent>
              </Card>
            </div>
          </PageSection>

          <PageSection
            className="mt-8"
            title="Pipeline health"
            description="Where leads are sitting, how long they have been there, and how much they are moving."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Stage distribution</CardTitle>
                  <CardDescription>Which stage this range&apos;s leads are in today.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CountTable
                    rows={byStage}
                    labelHeader="Stage"
                    emptyMessage="No leads in this range."
                    barClassByLabel={STAGE_BAR_BY_LABEL}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>How long leads have been idle</CardTitle>
                  <CardDescription>
                    Average days since each lead was last edited — a stand-in for time in stage, since any edit resets
                    it. High numbers mean leads are going quiet.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CountTable
                    rows={stageAging}
                    labelHeader="Stage"
                    countHeader="Avg days"
                    suffix="d"
                    emptyMessage="No leads in this range."
                    barClassByLabel={STAGE_BAR_BY_LABEL}
                  />
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Stage movement</CardTitle>
                <CardDescription>
                  Stage changes recorded in this date range, taken from the audit trail (most recent 500).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CountTable
                  rows={stageMovements}
                  labelHeader="Moved from → to"
                  countHeader="Moves"
                  emptyMessage="No stage changes were recorded in this range."
                  defaultBarClass="bg-chart-3"
                />
              </CardContent>
            </Card>
          </PageSection>

          <PageSection
            className="mt-8"
            title="Team performance"
            description="Leads follow the filters above. Follow-up counts are always as of now, across all dates."
          >
            <Card>
              <CardContent>
                {team.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    Nobody has leads or follow-ups matching these filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Representative
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Leads
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Hot
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Proposals
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Won
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Lost
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Follow-ups done
                          </TableHead>
                          <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Overdue
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {team.map((row) => (
                          <TableRow key={row.repId ?? "unassigned"}>
                            <TableCell className="text-sm font-medium">{row.repName}</TableCell>
                            <TableCell className="tabular-metric text-right text-sm">{row.totalLeads}</TableCell>
                            <TableCell className="tabular-metric text-right text-sm">{row.hot}</TableCell>
                            <TableCell className="tabular-metric text-right text-sm">{row.proposalsSent}</TableCell>
                            <TableCell className="tabular-metric text-right text-sm">{row.won}</TableCell>
                            <TableCell className="tabular-metric text-right text-sm">{row.lost}</TableCell>
                            <TableCell className="tabular-metric text-right text-sm">
                              {row.followUpsCompleted}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "tabular-metric text-right text-sm",
                                row.followUpsOverdue > 0 && "font-semibold text-destructive",
                              )}
                            >
                              {row.followUpsOverdue}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </PageSection>
        </>
      )}

      <aside className="mt-8 flex gap-3 rounded-xl border bg-muted/40 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">How to read these numbers</p>
          <p>
            &ldquo;Reached Hot&rdquo; and &ldquo;Proposals sent&rdquo; count leads <em>currently</em> in those stages,
            not every lead that ever passed through them — stage changes are recorded in the audit trail, but there is
            no per-stage entry timestamp yet.
          </p>
          <p>
            <Link href="/follow-ups?view=overdue" className="font-medium text-primary hover:underline">
              Overdue follow-ups
            </Link>{" "}
            are always measured as of right now, whatever date range is selected.
          </p>
        </div>
      </aside>
    </PageShell>
  );
}
