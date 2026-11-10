import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Mail,
  Phone,
  StickyNote,
  Building2,
  CalendarClock,
  BellRing,
  Plus,
  MessagesSquare,
  Tag,
  History,
  ArrowRight,
  UserCircle2,
} from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission, userHasPermission } from "@/lib/rbac/authorize";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, PageShell } from "@/components/page-shell";
import { LeadStageBadge, PipelineBadge } from "@/app/(app)/leads/lead-stage-badge";
import { LeadRowActions } from "@/app/(app)/leads/lead-row-actions";
import { LeadQuickActions } from "@/app/(app)/leads/lead-quick-actions";
import { LeadActivityDialog } from "@/app/(app)/leads/lead-activity-dialog";
import { LeadTimelineList } from "@/app/(app)/leads/lead-timeline-list";
import { getViewerTimeZone } from "@/lib/timezone-server";
import { FollowUpDialog } from "@/app/(app)/follow-ups/follow-up-dialog";
import {
  FollowUpStatusBadge,
  FollowUpTypeBadge,
  isFollowUpOverdue,
  OverdueBadge,
} from "@/app/(app)/follow-ups/follow-up-badges";
import { serializeLead } from "@/lib/queries/serialize-lead";
import { buildLeadTimeline } from "@/lib/queries/lead-timeline";
import {
  formatAmount,
  formatDateOrFallback,
  formatDateTime,
  formatDateTimeOrFallback,
  formatRelative,
  initialsOf,
  repName,
} from "@/lib/format";

const ADS_STAGE_OPTIONS = [
  { value: "COLD", label: "Cold" },
  { value: "WARM", label: "Warm" },
  { value: "HOT", label: "Hot" },
];

const WARM_APPROACH_STAGE_OPTIONS = [
  { value: "PLAN_MEET", label: "Plan Meet" },
  { value: "PITCHED", label: "Pitched" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
];

/** One labelled fact. Long-form values get their own full-width row. */
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function NotSet() {
  return <span className="font-normal text-muted-foreground">Not set</span>;
}

/** Renders a value, or a consistent "Not set" when it is empty. */
function Value({ children }: { children: React.ReactNode }) {
  return children ? <>{children}</> : <NotSet />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // Metadata resolves independently of the page body, so it needs its own
  // authorization check (mirrors the Client detail page's rationale).
  await requirePermission("leads.view");
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id }, select: { name: true } });
  return { title: lead?.name ?? "Lead" };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requirePermission("leads.view");
  const { id } = await params;
  const now = new Date();
  const timeZone = await getViewerTimeZone();

  const [lead, reps] = await Promise.all([
    db.lead.findUnique({
      where: { id },
      include: { assignedRep: { select: { id: true, firstName: true, lastName: true } } },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  if (!lead) notFound();

  const canUpdate = userHasPermission(currentUser, "leads.update");
  const canDelete = userHasPermission(currentUser, "leads.delete");

  const [activities, auditEvents, followUps] = await Promise.all([
    db.leadActivity.findMany({
      where: { leadId: lead.id },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { activityAt: "desc" },
      take: 50,
    }),
    db.auditLog.findMany({
      where: {
        action: { in: ["LEAD_CREATED", "LEAD_UPDATED", "LEAD_STAGE_CHANGED", "LEAD_ASSIGNED"] },
        metadata: { path: ["leadId"], equals: lead.id },
      },
      include: { actor: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.followUp.findMany({
      where: { leadId: lead.id },
      include: { assignedRep: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  const repNameById = new Map(reps.map((rep) => [rep.id, `${rep.firstName} ${rep.lastName}`]));
  const timeline = buildLeadTimeline({ activities, auditEvents, followUps, repNameById });
  const openFollowUps = followUps.filter((f) => f.status === "PENDING");
  const overdueCount = openFollowUps.filter((f) => isFollowUpOverdue(f, now)).length;
  const stageOptions = lead.pipeline === "ADS" ? ADS_STAGE_OPTIONS : WARM_APPROACH_STAGE_OPTIONS;
  const leadOption = [{ id: lead.id, name: lead.name, companyName: lead.companyName }];
  const isAds = lead.pipeline === "ADS";

  const scheduleFollowUpTrigger = (
    <Button variant="outline">
      <BellRing className="size-4" />
      Schedule follow-up
    </Button>
  );

  return (
    <PageShell>
      <PageHeader
        backHref="/leads"
        backLabel="All Leads"
        title={lead.name}
        description={
          lead.companyName
            ? `${lead.companyName} — ${isAds ? "came in through advertising" : "approached directly"}.`
            : `No company recorded. This lead ${isAds ? "came in through advertising" : "was approached directly"}.`
        }
        meta={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <LeadStageBadge stage={lead.stage} />
            <PipelineBadge pipeline={lead.pipeline} />
            <Badge variant={lead.assignedRep ? "secondary" : "outline"}>
              <UserCircle2 className="size-3" aria-hidden="true" />
              {repName(lead.assignedRep)}
            </Badge>
            {lead.outcome && (
              <Badge variant={lead.outcome === "WON" ? "success" : "destructive"}>
                {lead.outcome === "WON" ? "Won" : "Lost"}
              </Badge>
            )}
            {overdueCount > 0 && <OverdueBadge />}
          </div>
        }
        actions={
          <>
            {canUpdate && (
              <>
                <LeadActivityDialog
                  leadId={lead.id}
                  trigger={
                    <Button variant="outline">
                      <MessagesSquare className="size-4" />
                      Log activity
                    </Button>
                  }
                />
                <FollowUpDialog
                  leads={leadOption}
                  reps={reps}
                  defaultLeadId={lead.id}
                  trigger={scheduleFollowUpTrigger}
                />
              </>
            )}
            <LeadRowActions
              lead={serializeLead(lead)}
              reps={reps}
              canUpdate={canUpdate}
              canDelete={canDelete}
              redirectOnDeleteTo="/leads"
            />
          </>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* ── Overview: who this is and how to reach them ─────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Who this lead is and how to get hold of them.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Field label="Company">
                  <Value>{lead.companyName}</Value>
                </Field>
              </div>

              <div className="flex items-start gap-2.5">
                <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Field label="Where this lead came from">
                  <Value>{lead.source}</Value>
                </Field>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Field label="Email">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="break-all rounded-md hover:underline">
                      {lead.email}
                    </a>
                  ) : (
                    <NotSet />
                  )}
                </Field>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Field label="Phone">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="rounded-md hover:underline">
                      {lead.phone}
                    </a>
                  ) : (
                    <NotSet />
                  )}
                </Field>
              </div>

              <div className="flex items-start gap-2.5 sm:col-span-2">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Field label="Notes" wide>
                  {lead.notes ? (
                    <span className="whitespace-pre-wrap font-normal">{lead.notes}</span>
                  ) : (
                    <span className="font-normal text-muted-foreground">No notes yet.</span>
                  )}
                </Field>
              </div>
            </dl>

            <p className="mt-5 border-t pt-3 text-xs text-muted-foreground">
              Added {formatDateTime(lead.createdAt, timeZone)} · last edited {formatRelative(lead.updatedAt, now)}
            </p>
          </CardContent>
        </Card>

        {/* ── Ownership and stage movement ────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Ownership &amp; stage</CardTitle>
            <CardDescription>
              {canUpdate
                ? "Move this lead along, or hand it to someone else. Changes save immediately."
                : "Who is responsible, and where this lead sits."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback className="text-xs">
                  {lead.assignedRep
                    ? initialsOf(lead.assignedRep.firstName, lead.assignedRep.lastName)
                    : "—"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{repName(lead.assignedRep, "Nobody assigned")}</p>
                <p className="text-xs text-muted-foreground">
                  {lead.assignedRep ? "Responsible representative" : "Assign someone so it doesn't get missed"}
                </p>
              </div>
            </div>

            {canUpdate && (
              <div className="border-t pt-4">
                <LeadQuickActions
                  leadId={lead.id}
                  stage={lead.stage}
                  assignedRepId={lead.assignedRepId}
                  stageOptions={stageOptions}
                  reps={reps}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* ── Pipeline information: only the fields this pipeline uses ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {isAds ? "Ads pipeline details" : "Warm Approach pipeline details"}
            </CardTitle>
            <CardDescription>
              {isAds
                ? "Campaign and qualification information recorded for leads that arrive through advertising."
                : "Meeting, pitch and proposal information recorded for leads you approach directly."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAds ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Campaign">
                  <Value>{lead.campaignName}</Value>
                </Field>
                <Field label="Ad creative / ad set">
                  <Value>{lead.adCreative}</Value>
                </Field>
                <Field label="Enquiry submitted">{formatDateOrFallback(lead.submittedAt)}</Field>
                <Field label="Initial contact status">
                  <Value>{lead.initialContactStatus}</Value>
                </Field>
                <Field label="Interest level">
                  <Value>{lead.interestLevel}</Value>
                </Field>
                <Field label="Last communication">{formatDateOrFallback(lead.lastContactedAt)}</Field>
                <Field label="What they need now">
                  <Value>{lead.immediateRequirement}</Value>
                </Field>
                <Field label="Chance of closing">
                  {lead.closingProbability != null ? `${lead.closingProbability}%` : <NotSet />}
                </Field>
                <Field label="Meeting or call booked">
                  <Badge variant={lead.meetingScheduled ? "success" : "outline"}>
                    {lead.meetingScheduled ? "Yes" : "Not yet"}
                  </Badge>
                </Field>
                <Field label="Qualification notes" wide>
                  {lead.qualificationNotes ? (
                    <span className="whitespace-pre-wrap font-normal">{lead.qualificationNotes}</span>
                  ) : (
                    <NotSet />
                  )}
                </Field>
              </dl>
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Last interaction">{formatDateOrFallback(lead.lastInteractionAt)}</Field>
                <Field label="Meeting booked for">{formatDateTimeOrFallback(lead.scheduledMeetingAt, timeZone)}</Field>
                <Field label="Pitched on">{formatDateOrFallback(lead.pitchedAt)}</Field>
                <Field label="Service discussed">
                  <Value>{lead.serviceDiscussed}</Value>
                </Field>
                <Field label="Proposal amount">
                  {lead.proposalAmount ? formatAmount(lead.proposalAmount.toString()) : <NotSet />}
                </Field>
                <Field label="Proposal sent">{formatDateOrFallback(lead.proposalSentAt)}</Field>
                <Field label="Expected to close">{formatDateOrFallback(lead.expectedCloseAt)}</Field>
                <Field label="Outcome">
                  {lead.outcome ? (
                    <Badge variant={lead.outcome === "WON" ? "success" : "destructive"}>
                      {lead.outcome === "WON" ? "Won" : "Lost"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Still open</Badge>
                  )}
                </Field>
                {lead.proposalDocUrl && (
                  <Field label="Proposal document">
                    <a
                      href={lead.proposalDocUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-md text-primary hover:underline"
                    >
                      Open document
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </a>
                  </Field>
                )}
                <Field label="Next action">
                  <Value>{lead.nextAction}</Value>
                </Field>
                <Field label="Feedback / objections" wide>
                  {lead.feedback ? (
                    <span className="whitespace-pre-wrap font-normal">{lead.feedback}</span>
                  ) : (
                    <NotSet />
                  )}
                </Field>
                <Field label="Follow-up notes" wide>
                  {lead.followUpNotes ? (
                    <span className="whitespace-pre-wrap font-normal">{lead.followUpNotes}</span>
                  ) : (
                    <NotSet />
                  )}
                </Field>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* ── Follow-ups for this lead ───────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Follow-ups</CardTitle>
            <CardDescription>
              {followUps.length === 0
                ? "Nothing scheduled for this lead yet."
                : `${openFollowUps.length} open of ${followUps.length} total${
                    overdueCount > 0 ? `, ${overdueCount} overdue` : ""
                  }.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUps.length === 0 ? (
              <EmptyState
                size="sm"
                icon={BellRing}
                title="No follow-ups"
                description="Schedule one so this lead doesn't go quiet."
                action={
                  canUpdate && (
                    <FollowUpDialog
                      leads={leadOption}
                      reps={reps}
                      defaultLeadId={lead.id}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Plus className="size-4" />
                          Schedule follow-up
                        </Button>
                      }
                    />
                  )
                }
              />
            ) : (
              <>
                <ul className="divide-y">
                  {followUps.slice(0, 6).map((followUp) => {
                    const overdue = isFollowUpOverdue(followUp, now);
                    return (
                      <li
                        key={followUp.id}
                        className={cn(
                          "space-y-1.5 py-2.5 first:pt-0",
                          followUp.status !== "PENDING" && "opacity-70",
                        )}
                      >
                        <p className="text-sm font-medium">{followUp.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {overdue ? <OverdueBadge /> : <FollowUpStatusBadge status={followUp.status} />}
                          <FollowUpTypeBadge type={followUp.type} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Due {formatDateTime(followUp.dueAt, timeZone)} · {repName(followUp.assignedRep)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href="/follow-ups"
                  className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline"
                >
                  Open the follow-ups queue
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Activity timeline ────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            Activity timeline
          </CardTitle>
          <CardDescription>
            Everything that has happened to this lead — calls, notes, meetings, emails, stage changes,
            assignments and follow-ups — newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing has happened yet"
              description="Log a call, note or meeting and it will start building this lead's history."
              action={
                canUpdate && (
                  <LeadActivityDialog
                    leadId={lead.id}
                    trigger={
                      <Button size="sm" variant="outline">
                        <MessagesSquare className="size-4" />
                        Log activity
                      </Button>
                    }
                  />
                )
              }
            />
          ) : (
            <LeadTimelineList entries={timeline} now={now} timeZone={timeZone} />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
