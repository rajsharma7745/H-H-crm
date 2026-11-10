import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BellRing, Plus, SearchX, Target } from "lucide-react";
import { db } from "@/lib/db";
import { getViewerTimeZone } from "@/lib/timezone-server";
import { requirePermission, userHasPermission } from "@/lib/rbac/authorize";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/empty-state";
import { ActiveFilters, type ActiveFilter } from "@/components/active-filters";
import { FilterBar, PageHeader, PageShell, ResultCount } from "@/components/page-shell";
import { FollowUpDialog } from "@/app/(app)/follow-ups/follow-up-dialog";
import { FollowUpFilters } from "@/app/(app)/follow-ups/follow-up-filters";
import { FollowUpList } from "@/app/(app)/follow-ups/follow-up-list";
import {
  buildFollowUpWhere,
  buildFollowUpViewWhere,
  parseFollowUpView,
  FOLLOW_UP_VIEWS,
  type FollowUpView,
} from "@/lib/queries/follow-ups";

export const metadata: Metadata = { title: "Follow-ups" };

const VIEW_LABEL: Record<FollowUpView, string> = {
  today: "Today",
  upcoming: "Upcoming",
  overdue: "Overdue",
  completed: "Done",
  all: "All",
};

/** What each view answers, in the words somebody would actually use. */
const VIEW_DESCRIPTION: Record<FollowUpView, string> = {
  today: "Everything you still need to do today.",
  upcoming: "Work that is scheduled, but not due yet.",
  overdue: "Work whose due time has already passed — start here.",
  completed: "Follow-ups you have already marked done.",
  all: "Every follow-up, whatever its date or status.",
};

const PRIORITY_DISPLAY: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
const STATUS_DISPLAY: Record<string, string> = {
  PENDING: "Open",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; priority?: string; status?: string; assignedRep?: string }>;
}) {
  const currentUser = await requirePermission("leads.view");
  const { view: viewParam, q, priority, status, assignedRep } = await searchParams;

  // Follow-up writes reuse leads.update (see src/lib/actions/follow-ups.ts).
  const canManage = userHasPermission(currentUser, "leads.update");

  const view = parseFollowUpView(viewParam);
  // One `now` for the whole render, so the bucket counts, the list query and
  // the overdue badges can't disagree with each other mid-request.
  const now = new Date();
  const timeZone = await getViewerTimeZone();

  const where = buildFollowUpWhere({ view, q, priority, status, assignedRep, now, timeZone });

  const [followUps, leads, reps, viewCounts, totalFollowUpCount] = await Promise.all([
    db.followUp.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, companyName: true } },
        assignedRep: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: view === "completed" ? { completedAt: "desc" } : { dueAt: "asc" },
    }),
    db.lead.findMany({
      select: { id: true, name: true, companyName: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    Promise.all(
      FOLLOW_UP_VIEWS.map((v) => db.followUp.count({ where: buildFollowUpViewWhere(v, now, timeZone) })),
    ),
    db.followUp.count(),
  ]);

  const countByView = Object.fromEntries(FOLLOW_UP_VIEWS.map((v, i) => [v, viewCounts[i]])) as Record<
    FollowUpView,
    number
  >;

  // The unfiltered size of the view the user is on — the denominator for
  // "3 of 12", so a filtered view is visibly a subset of that view.
  const viewTotal = countByView[view];

  const chips: ActiveFilter[] = [];
  if (q) chips.push({ key: "q", label: "Search", display: q });
  if (priority && priority in PRIORITY_DISPLAY) {
    chips.push({ key: "priority", label: "Priority", display: PRIORITY_DISPLAY[priority] });
  }
  if (view === "all" && status && status in STATUS_DISPLAY) {
    chips.push({ key: "status", label: "Status", display: STATUS_DISPLAY[status] });
  }
  if (assignedRep) {
    const rep = reps.find((r) => r.id === assignedRep);
    chips.push({
      key: "assignedRep",
      label: "Responsible",
      display: rep ? `${rep.firstName} ${rep.lastName}` : "Selected person",
    });
  }

  function viewHref(target: FollowUpView): string {
    const params = new URLSearchParams();
    params.set("view", target);
    if (q) params.set("q", q);
    if (priority) params.set("priority", priority);
    if (assignedRep) params.set("assignedRep", assignedRep);
    return `/follow-ups?${params.toString()}`;
  }

  const scheduleButton = (
    <FollowUpDialog
      leads={leads}
      reps={reps}
      trigger={
        <Button>
          <Plus className="size-4" />
          Schedule follow-up
        </Button>
      }
    />
  );

  return (
    <PageShell width="wide">
      <PageHeader
        title="Follow-ups"
        description="Your daily work queue. Start with Overdue, clear Today, then look at what is coming up. Every follow-up belongs to a lead."
        actions={canManage && leads.length > 0 ? scheduleButton : undefined}
      />

      {/*
        The views were plain text links with a grey active state. They are now a
        segmented control: one obvious selected tab, a count on every tab, and
        the overdue count in red so the thing you should do first is the thing
        that catches your eye.
      */}
      <nav aria-label="Follow-up views" className="mt-6 overflow-x-auto pb-1">
        <ul className="inline-flex min-w-full gap-1 rounded-xl border bg-muted/60 p-1 sm:min-w-0">
          {FOLLOW_UP_VIEWS.map((v) => {
            const selected = v === view;
            const count = countByView[v];
            const urgent = v === "overdue" && count > 0;

            return (
              <li key={v} className="flex-1 sm:flex-initial">
                <Link
                  href={viewHref(v)}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "bg-card text-foreground shadow-xs ring-1 ring-border"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  {VIEW_LABEL[v]}
                  <span
                    className={cn(
                      "tabular-metric rounded-full px-1.5 py-px text-[11px] font-semibold",
                      urgent
                        ? "bg-destructive/10 text-destructive"
                        : selected
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="mt-3 text-sm text-muted-foreground">{VIEW_DESCRIPTION[view]}</p>

      {totalFollowUpCount > 0 && (
        <FilterBar className="mt-4">
          <Suspense fallback={null}>
            <FollowUpFilters reps={reps} showStatus={view === "all"} />
          </Suspense>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Suspense fallback={null}>
              <ActiveFilters filters={chips} alsoClear={["q", "priority", "status", "assignedRep"]} />
            </Suspense>
            <ResultCount shown={followUps.length} total={viewTotal} noun="follow-up" />
          </div>
        </FilterBar>
      )}

      <div className="mt-4">
        {totalFollowUpCount === 0 && (
          <EmptyPanel
            icon={leads.length === 0 ? Target : BellRing}
            title="No follow-ups yet"
            description={
              leads.length === 0
                ? "Follow-ups are always attached to a lead, so add a lead first — then you can schedule a call, email or meeting against it."
                : "A follow-up is a reminder to contact a lead at a certain time. Schedule your first one and it will appear in this queue."
            }
            action={
              leads.length === 0 ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link href="/leads">
                      <Plus className="size-4" />
                      Add a lead first
                    </Link>
                  }
                />
              ) : canManage ? (
                scheduleButton
              ) : undefined
            }
          />
        )}

        {totalFollowUpCount > 0 && followUps.length === 0 && (
          <EmptyPanel
            icon={chips.length > 0 ? SearchX : BellRing}
            title={chips.length > 0 ? "Nothing matches your filters" : `Nothing in ${VIEW_LABEL[view]}`}
            description={
              chips.length > 0
                ? "No follow-up in this view matches everything you are filtering by. Remove a filter above to see more."
                : `${VIEW_DESCRIPTION[view]} There is nothing here right now — which is usually good news.`
            }
          />
        )}

        {followUps.length > 0 && (
          <FollowUpList followUps={followUps} leads={leads} reps={reps} canUpdate={canManage} now={now} timeZone={timeZone} />
        )}
      </div>
    </PageShell>
  );
}
