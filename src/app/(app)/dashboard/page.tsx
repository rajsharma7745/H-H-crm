import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Target,
  Megaphone,
  Handshake,
  BellRing,
  AlertTriangle,
  FileText,
  Trophy,
  XCircle,
  Inbox,
  Plus,
  ArrowRight,
  CalendarCheck,
  Activity,
  GitBranch,
  CheckCircle2,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireAuth, userHasPermission } from "@/lib/rbac/authorize";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { PageHeader, PageSection, PageShell } from "@/components/page-shell";
import { GreetingHeading } from "@/components/app-shell/greeting-heading";
import { DateRangeFilter } from "@/components/date-range-filter";
import {
  LeadStageBadge,
  PipelineBadge,
  STAGE_DOT_CLASS,
  STAGE_LABEL,
} from "@/app/(app)/leads/lead-stage-badge";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getViewerTimeZone } from "@/lib/timezone-server";
import { resolveDateRange, createdAtWhere } from "@/lib/queries/date-range";
import { getDashboardMetrics } from "@/lib/queries/dashboard";
import { buildFollowUpViewWhere } from "@/lib/queries/follow-ups";
import type { LeadStage } from "@prisma/client";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * A labelled proportion bar per row. Bars are tinted with each stage's own
 * hue (see lead-stage-badge.tsx) rather than all being the same black, so the
 * two distributions can be read without cross-referencing the labels.
 */
function Distribution({
  rows,
  emptyMessage,
}: {
  rows: { label: string; count: number; barClass: string }[];
  emptyMessage: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className="grid gap-3">
      {rows.map((row) => {
        const percent = Math.round((row.count / total) * 100);
        return (
          <div key={row.label} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", row.barClass)} aria-hidden="true" />
                <span className="truncate font-medium">{row.label}</span>
              </span>
              <span className="tabular-metric shrink-0 text-muted-foreground">
                {row.count} <span className="text-muted-foreground/70">({percent}%)</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", row.barClass)} style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "See all" footer link, shared by the dashboard's list cards. */
function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary transition-colors hover:text-primary/80"
    >
      {children}
      <ArrowRight className="size-3" aria-hidden="true" />
    </Link>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const timeZone = await getViewerTimeZone();

  const canViewLeads = userHasPermission(user, "leads.view");
  const canCreateLeads = userHasPermission(user, "leads.create");

  // Everyone can reach the dashboard, but a user without leads.view has no
  // business seeing lead metrics — show them the account panel only.
  if (!canViewLeads) {
    return (
      <PageShell width="narrow">
        <PageHeader
          title={<GreetingHeading firstName={user.firstName} />}
          description="Your role doesn't include access to lead data, so this page shows your account details instead of metrics."
        />
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>Ask an administrator if you need access to leads or reports.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <Badge variant="secondary" className="mt-1.5">
                {user.role.name}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last login</p>
              <p className="mt-1.5 text-sm font-medium">
                {user.lastLoginAt ? formatDateTime(user.lastLoginAt, timeZone) : "This is your first login"}
              </p>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // One `now` for the whole render so every metric agrees.
  const now = new Date();
  const range = resolveDateRange(params, now);

  const [metrics, upcomingFollowUps, overdueFollowUps, recentLeads, recentActivities, recentStageChanges] =
    await Promise.all([
      getDashboardMetrics(range, now),
      db.followUp.findMany({
      where: buildFollowUpViewWhere("upcoming", now, timeZone),
      include: { lead: { select: { id: true, name: true } } },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    db.followUp.findMany({
      where: buildFollowUpViewWhere("overdue", now, timeZone),
      include: { lead: { select: { id: true, name: true } } },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    db.lead.findMany({
      where: createdAtWhere(range),
      select: { id: true, name: true, companyName: true, pipeline: true, stage: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.leadActivity.findMany({
      include: {
        lead: { select: { id: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { activityAt: "desc" },
      take: 5,
    }),
    db.auditLog.findMany({
      where: { action: "LEAD_STAGE_CHANGED" },
      include: { actor: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Order is the visual hierarchy: what needs doing, then volume, then outcome.
  const kpis = [
    {
      key: "overdue-follow-ups",
      label: "Overdue follow-ups",
      value: metrics.overdueFollowUps,
      icon: AlertTriangle,
      note: "Past their due time and still open",
      tone: metrics.overdueFollowUps > 0 ? ("danger" as const) : ("success" as const),
      emphasise: metrics.overdueFollowUps > 0,
    },
    {
      key: "pending-follow-ups",
      label: "Open follow-ups",
      value: metrics.pendingFollowUps,
      icon: BellRing,
      note: "Scheduled and not yet done",
      tone: "warning" as const,
    },
    {
      key: "active",
      label: "Active leads",
      value: metrics.activeLeads,
      icon: Target,
      note: "Still in play, not won or lost",
      tone: "brand" as const,
    },
    {
      key: "proposals",
      label: "Proposals out",
      value: metrics.proposalsSent,
      icon: FileText,
      note: "Sitting in the Proposal Sent stage",
      tone: "brand" as const,
    },
    {
      key: "ads",
      label: "Ads leads",
      value: metrics.adsLeads,
      icon: Megaphone,
      note: "New in the Ads pipeline",
    },
    {
      key: "warm-approach",
      label: "Warm Approach leads",
      value: metrics.warmApproachLeads,
      icon: Handshake,
      note: "New in the Warm Approach pipeline",
    },
    {
      key: "won",
      label: "Won",
      value: metrics.won,
      icon: Trophy,
      note: "Marked Won in this period",
      tone: "success" as const,
    },
    {
      key: "lost",
      label: "Lost",
      value: metrics.lost,
      icon: XCircle,
      note: "Marked Lost in this period",
    },
  ];

  const stageRows = (Object.keys(STAGE_LABEL) as LeadStage[]).map((stage) => ({
    label: STAGE_LABEL[stage],
    count: metrics.byStage[stage],
    barClass: STAGE_DOT_CLASS[stage],
  }));

  return (
    <PageShell>
      <PageHeader
        title={<GreetingHeading firstName={user.firstName} />}
        description={
          <>
            Here is where your leads stand for{" "}
            <span className="font-medium text-foreground">{range.label.toLowerCase()}</span>. Lead counts are based on
            when each lead was created; follow-up counts are always as of right now.
          </>
        }
        actions={
          <Suspense fallback={null}>
            <DateRangeFilter />
          </Suspense>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            note={kpi.note}
            icon={kpi.icon}
            tone={kpi.tone}
            emphasise={kpi.emphasise}
          />
        ))}
      </div>

      <Separator className="my-8" />

      <PageSection
        title="Needs attention"
        description="Follow-up work, measured as of now — the date filter above does not apply here."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Overdue is the one card on this page allowed to look alarming. */}
          <Card className={cn(overdueFollowUps.length > 0 && "ring-destructive/25")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-md",
                    overdueFollowUps.length > 0
                      ? "bg-destructive/10 text-destructive"
                      : "bg-success/10 text-success",
                  )}
                >
                  {overdueFollowUps.length > 0 ? (
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  )}
                </span>
                Overdue
              </CardTitle>
              <CardDescription>Open follow-ups whose due time has already passed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overdueFollowUps.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={CheckCircle2}
                  title="Nothing overdue"
                  description="Every scheduled follow-up is still within its due time."
                />
              ) : (
                <ul className="divide-y">
                  {overdueFollowUps.map((followUp) => (
                    <li key={followUp.id} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                      <Link href={`/leads/${followUp.lead.id}`} className="min-w-0 rounded-md hover:underline">
                        <span className="block truncate text-sm font-medium">{followUp.title}</span>
                        <span className="text-xs text-muted-foreground">{followUp.lead.name}</span>
                      </Link>
                      <span className="shrink-0 text-right">
                        <Badge variant="destructive">{formatRelative(followUp.dueAt, now)}</Badge>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatDateTime(followUp.dueAt, timeZone)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <CardLink href="/follow-ups?view=overdue">See all overdue follow-ups</CardLink>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-info/10 text-info">
                  <CalendarCheck className="size-3.5" aria-hidden="true" />
                </span>
                Coming up
              </CardTitle>
              <CardDescription>Open follow-ups due after today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingFollowUps.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={CalendarCheck}
                  title="Nothing scheduled"
                  description="Schedule a follow-up from a lead's page so it shows up here."
                />
              ) : (
                <ul className="divide-y">
                  {upcomingFollowUps.map((followUp) => (
                    <li key={followUp.id} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                      <Link href={`/leads/${followUp.lead.id}`} className="min-w-0 rounded-md hover:underline">
                        <span className="block truncate text-sm font-medium">{followUp.title}</span>
                        <span className="text-xs text-muted-foreground">{followUp.lead.name}</span>
                      </Link>
                      <span className="shrink-0 text-right">
                        <Badge variant="info">{formatRelative(followUp.dueAt, now)}</Badge>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatDateTime(followUp.dueAt, timeZone)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <CardLink href="/follow-ups?view=upcoming">See all upcoming follow-ups</CardLink>
            </CardContent>
          </Card>
        </div>
      </PageSection>

      <PageSection
        className="mt-8"
        title="Where your leads sit"
        description={`Leads created in ${range.label.toLowerCase()}, by pipeline and by current stage.`}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By pipeline</CardTitle>
              <CardDescription>How new leads split between the two ways they reach you.</CardDescription>
            </CardHeader>
            <CardContent>
              <Distribution
                emptyMessage="No leads were created in this period."
                rows={[
                  { label: "Ads", count: metrics.adsLeads, barClass: "bg-chart-1" },
                  { label: "Warm Approach", count: metrics.warmApproachLeads, barClass: "bg-chart-3" },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By stage</CardTitle>
              <CardDescription>Which stage each of those leads is in today.</CardDescription>
            </CardHeader>
            <CardContent>
              <Distribution rows={stageRows} emptyMessage="No leads were created in this period." />
            </CardContent>
          </Card>
        </div>
      </PageSection>

      <PageSection
        className="mt-8"
        title="Latest changes"
        description="The most recent five of each, across all leads."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="size-4 text-muted-foreground" aria-hidden="true" />
                New leads
              </CardTitle>
              <CardDescription>Newest first, within the selected period.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentLeads.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={Inbox}
                  title="No new leads in this period"
                  description="Widen the date range, or add a lead to get started."
                  action={
                    canCreateLeads && (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={
                          <Link href="/leads">
                            <Plus className="size-4" />
                            Add a lead
                          </Link>
                        }
                      />
                    )
                  }
                />
              ) : (
                <ul className="divide-y">
                  {recentLeads.map((lead) => (
                    <li key={lead.id} className="grid gap-1.5 py-2 first:pt-0">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="truncate rounded-md text-sm font-medium hover:underline"
                      >
                        {lead.name}
                      </Link>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <PipelineBadge pipeline={lead.pipeline} />
                        <LeadStageBadge stage={lead.stage} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
                Logged activity
              </CardTitle>
              <CardDescription>Calls, notes, meetings and emails your team recorded.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={Inbox}
                  title="Nothing logged yet"
                  description="Open a lead and use Log activity to record a call or note."
                />
              ) : (
                <ul className="divide-y">
                  {recentActivities.map((activity) => (
                    <li key={activity.id} className="grid gap-0.5 py-2 first:pt-0">
                      <Link
                        href={`/leads/${activity.lead.id}`}
                        className="truncate rounded-md text-sm font-medium hover:underline"
                      >
                        {activity.title}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        {activity.lead.name}
                        {activity.createdBy ? ` · ${activity.createdBy.firstName} ${activity.createdBy.lastName}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="size-4 text-muted-foreground" aria-hidden="true" />
                Stage moves
              </CardTitle>
              <CardDescription>Leads that moved forward or back in a pipeline.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentStageChanges.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={Inbox}
                  title="No stage changes yet"
                  description="Moving a lead between stages will show up here."
                />
              ) : (
                <ul className="divide-y">
                  {recentStageChanges.map((event) => {
                    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
                    const leadId = metadata.leadId as string | undefined;
                    const from = STAGE_LABEL[metadata.fromStage as LeadStage] ?? "—";
                    const to = STAGE_LABEL[metadata.toStage as LeadStage] ?? "—";
                    return (
                      <li key={event.id} className="grid gap-0.5 py-2 first:pt-0">
                        {leadId ? (
                          <Link
                            href={`/leads/${leadId}`}
                            className="truncate rounded-md text-sm font-medium hover:underline"
                          >
                            {String(metadata.name ?? "A lead")}
                          </Link>
                        ) : (
                          <span className="truncate text-sm font-medium">{String(metadata.name ?? "A lead")}</span>
                        )}
                        <span className="flex flex-wrap items-center gap-1 truncate text-xs text-muted-foreground">
                          {from}
                          <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
                          {to}
                          {event.actor ? ` · ${event.actor.firstName} ${event.actor.lastName}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </PageSection>
    </PageShell>
  );
}
