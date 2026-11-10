import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadStageBadge, PipelineBadge, PIPELINE_LABEL } from "@/app/(app)/leads/lead-stage-badge";
import { LeadRowActions } from "@/app/(app)/leads/lead-row-actions";
import { formatDate, formatRelative, repName } from "@/lib/format";
import type { EditableLead } from "@/app/(app)/leads/lead-dialog";

type Rep = { id: string; firstName: string; lastName: string };

export type LeadListRow = EditableLead & {
  updatedAt: Date;
  assignedRep: Rep | null;
};

/**
 * Two presentations of one list: a table from `md` up, stacked cards below it.
 *
 * The table's own changes are all about scanning — roomier rows, the lead name
 * as the obvious click target, one semantic badge per status, and "Updated"
 * written as "3 days ago" with the exact date on hover, since a column of
 * absolute dates is something you have to decode rather than read.
 */
export function LeadList({
  leads,
  reps,
  canUpdate,
  canDelete,
  now,
}: {
  leads: LeadListRow[];
  reps: Rep[];
  canUpdate: boolean;
  canDelete: boolean;
  /** The server's render clock, so relative dates can't drift on hydration. */
  now: Date;
}) {
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="py-2.5 pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lead
              </TableHead>
              <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact
              </TableHead>
              <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pipeline
              </TableHead>
              <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Stage
              </TableHead>
              <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Responsible
              </TableHead>
              <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Updated
              </TableHead>
              <TableHead className="w-12 py-2.5 pr-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id} className="align-top">
                <TableCell className="py-3 pl-4">
                  <Link href={`/leads/${lead.id}`} className="block min-w-0 rounded-md">
                    <span className="block max-w-56 truncate text-sm font-semibold text-foreground hover:text-primary hover:underline">
                      {lead.name}
                    </span>
                    <span className="mt-0.5 block max-w-56 truncate text-xs text-muted-foreground">
                      {lead.companyName || "No company"}
                      {lead.source ? ` · ${lead.source}` : ""}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="py-3">
                  {lead.email || lead.phone ? (
                    <div className="grid gap-0.5 text-xs text-muted-foreground">
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex max-w-52 items-center gap-1.5 rounded-md hover:text-foreground hover:underline"
                        >
                          <Mail className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{lead.email}</span>
                        </a>
                      )}
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-1.5 rounded-md hover:text-foreground hover:underline"
                        >
                          <Phone className="size-3 shrink-0" aria-hidden="true" />
                          {lead.phone}
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No contact details</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <PipelineBadge pipeline={lead.pipeline} />
                </TableCell>
                <TableCell className="py-3">
                  <LeadStageBadge stage={lead.stage} />
                </TableCell>
                <TableCell className="py-3 text-sm">
                  {lead.assignedRep ? (
                    repName(lead.assignedRep)
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-sm text-muted-foreground" title={formatDate(lead.updatedAt)}>
                  {formatRelative(lead.updatedAt, now)}
                </TableCell>
                <TableCell className="py-3 pr-3">
                  <LeadRowActions lead={lead} reps={reps} canUpdate={canUpdate} canDelete={canDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards, no horizontal scroll */}
      <div className="grid gap-3 md:hidden">
        {leads.map((lead) => (
          <Card key={lead.id} size="sm">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/leads/${lead.id}`} className="min-w-0 rounded-md">
                  <p className="truncate text-sm font-semibold hover:underline">{lead.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {lead.companyName || PIPELINE_LABEL[lead.pipeline]}
                  </p>
                </Link>
                <LeadRowActions lead={lead} reps={reps} canUpdate={canUpdate} canDelete={canDelete} />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <LeadStageBadge stage={lead.stage} />
                <PipelineBadge pipeline={lead.pipeline} />
                <Badge variant={lead.assignedRep ? "secondary" : "outline"}>{repName(lead.assignedRep)}</Badge>
              </div>

              {(lead.email || lead.phone) && (
                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="flex items-center gap-2 rounded-md">
                      <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{lead.email}</span>
                    </a>
                  )}
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-2 rounded-md">
                      <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                      {lead.phone}
                    </a>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Updated {formatRelative(lead.updatedAt, now)} · {formatDate(lead.updatedAt)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
