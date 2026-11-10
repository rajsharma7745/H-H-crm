import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FollowUpRowActions } from "@/app/(app)/follow-ups/follow-up-row-actions";
import {
  FOLLOW_UP_TYPE_ICON,
  FOLLOW_UP_TYPE_LABEL,
  FollowUpPriorityBadge,
  FollowUpStatusBadge,
  isFollowUpOverdue,
  OverdueBadge,
} from "@/app/(app)/follow-ups/follow-up-badges";
import { formatDateTime, formatFollowUpWhen, repName } from "@/lib/format";
import type { EditableFollowUp } from "@/app/(app)/follow-ups/follow-up-dialog";

type Rep = { id: string; firstName: string; lastName: string };
type LeadOption = { id: string; name: string; companyName: string | null };

export type FollowUpRow = EditableFollowUp & {
  lead: { id: string; name: string; companyName: string | null };
  assignedRep: Rep | null;
};

export function FollowUpList({
  followUps,
  leads,
  reps,
  canUpdate,
  now,
  timeZone,
}: {
  followUps: FollowUpRow[];
  leads: LeadOption[];
  reps: Rep[];
  canUpdate: boolean;
  /** The server's render clock — see isFollowUpOverdue. */
  now: Date;
  /** The viewer's IANA zone, so due times render in their zone rather than the server's. */
  timeZone: string;
}) {
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="border-l-4 border-l-transparent py-2.5 pl-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Follow-up
              </TableHead>
              <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lead
              </TableHead>
              <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Due
              </TableHead>
              <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Responsible
              </TableHead>
              <TableHead className="py-2.5 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {followUps.map((followUp) => {
              const overdue = isFollowUpOverdue(followUp, now);
              const done = followUp.status !== "PENDING";
              const TypeIcon = FOLLOW_UP_TYPE_ICON[followUp.type];

              return (
                <TableRow
                  key={followUp.id}
                  className={cn(
                    "align-top",
                    // Overdue rows are tinted, and finished ones recede, so the
                    // queue can be triaged without reading every cell.
                    overdue && "bg-destructive/[0.04] hover:bg-destructive/[0.07]",
                    done && "text-muted-foreground",
                  )}
                >
                  {/* A coloured edge, so urgency is not carried by tint alone. */}
                  <TableCell
                    className={cn(
                      "border-l-4 py-3 pl-3",
                      overdue
                        ? "border-l-destructive"
                        : followUp.status === "COMPLETED"
                          ? "border-l-success/60"
                          : followUp.status === "CANCELLED"
                            ? "border-l-border"
                            : "border-l-info/50",
                    )}
                  >
                    <p className={cn("text-sm font-semibold", done && "font-medium line-through decoration-1")}>
                      {followUp.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TypeIcon className="size-3 shrink-0" aria-hidden="true" />
                      {FOLLOW_UP_TYPE_LABEL[followUp.type]}
                    </p>
                  </TableCell>

                  <TableCell className="py-3">
                    <Link href={`/leads/${followUp.lead.id}`} className="block min-w-0 rounded-md">
                      <span className="block max-w-48 truncate text-sm hover:text-primary hover:underline">
                        {followUp.lead.name}
                      </span>
                      {followUp.lead.companyName && (
                        <span className="block max-w-48 truncate text-xs text-muted-foreground">
                          {followUp.lead.companyName}
                        </span>
                      )}
                    </Link>
                  </TableCell>

                  <TableCell className="py-3">
                    <p className={cn("text-sm font-medium", overdue && "text-destructive")}>
                      {formatFollowUpWhen(followUp, now, timeZone)}
                    </p>
                    {followUp.status === "PENDING" && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(followUp.dueAt, timeZone)}</p>
                    )}
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {overdue ? <OverdueBadge /> : <FollowUpStatusBadge status={followUp.status} />}
                      <FollowUpPriorityBadge priority={followUp.priority} />
                    </div>
                  </TableCell>

                  <TableCell className="py-3 text-sm">
                    {followUp.assignedRep ? (
                      repName(followUp.assignedRep)
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>

                  <TableCell className="py-3 pr-3">
                    <FollowUpRowActions followUp={followUp} leads={leads} reps={reps} canUpdate={canUpdate} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="grid gap-3 md:hidden">
        {followUps.map((followUp) => {
          const overdue = isFollowUpOverdue(followUp, now);
          const done = followUp.status !== "PENDING";

          return (
            <Card
              key={followUp.id}
              size="sm"
              className={cn(
                "border-l-4 border-l-transparent",
                overdue && "border-l-destructive bg-destructive/[0.04]",
                !overdue && followUp.status === "PENDING" && "border-l-info/50",
                followUp.status === "COMPLETED" && "border-l-success/60 opacity-75",
                followUp.status === "CANCELLED" && "opacity-75",
              )}
            >
              <CardContent className="flex flex-col gap-3">
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold", done && "line-through decoration-1")}>
                    {followUp.title}
                  </p>
                  <Link
                    href={`/leads/${followUp.lead.id}`}
                    className="mt-0.5 block truncate rounded-md text-xs text-muted-foreground hover:underline"
                  >
                    {followUp.lead.name}
                    {followUp.lead.companyName ? ` · ${followUp.lead.companyName}` : ""}
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {overdue ? <OverdueBadge /> : <FollowUpStatusBadge status={followUp.status} />}
                  <FollowUpPriorityBadge priority={followUp.priority} />
                </div>

                <div className="text-xs text-muted-foreground">
                  <p className={cn("font-medium", overdue ? "text-destructive" : "text-foreground")}>
                    {followUp.status === "PENDING" ? "Due " : "Was due "}
                    {formatFollowUpWhen(followUp, now, timeZone)}
                  </p>
                  <p className="mt-0.5">
                    {followUp.status === "PENDING" && <>{formatDateTime(followUp.dueAt, timeZone)} · </>}
                    {FOLLOW_UP_TYPE_LABEL[followUp.type]} ·{" "}
                    {repName(followUp.assignedRep)}
                  </p>
                </div>

                <FollowUpRowActions followUp={followUp} leads={leads} reps={reps} canUpdate={canUpdate} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
