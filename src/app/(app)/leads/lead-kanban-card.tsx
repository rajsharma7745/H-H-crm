"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Mail, Phone, Loader2, CalendarClock, Target, Banknote, Flag, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { moveLeadStageAction } from "@/lib/actions/leads";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadRowActions } from "@/app/(app)/leads/lead-row-actions";
import { STAGE_LABEL } from "@/app/(app)/leads/lead-stage-badge";
import type { PipelineStageOption } from "@/app/(app)/leads/pipeline-board";
import type { LeadListRow } from "@/app/(app)/leads/lead-list";
import { formatAmount, formatDate, repName } from "@/lib/format";
import type { LeadStage } from "@prisma/client";

type Rep = { id: string; firstName: string; lastName: string };

/**
 * The facts worth surfacing depend on the stage, which is the whole point of a
 * board: a Plan Meet card is useful if it shows the meeting date, and a
 * Proposal Sent card is useful if it shows the amount and the expected close.
 * Anything not set is omitted rather than shown as a row of "Not set", so
 * cards stay short and every line on a card carries information.
 */
function stageFacts(lead: LeadListRow): { icon: typeof Target; label: string; value: string }[] {
  const facts: { icon: typeof Target; label: string; value: string }[] = [];

  switch (lead.stage) {
    case "COLD":
    case "WARM":
    case "HOT": {
      if (lead.campaignName) facts.push({ icon: Megaphone, label: "Campaign", value: lead.campaignName });
      if (lead.lastContactedAt)
        facts.push({ icon: CalendarClock, label: "Last contact", value: formatDate(lead.lastContactedAt) });
      if (lead.immediateRequirement)
        facts.push({ icon: Flag, label: "Needs", value: lead.immediateRequirement });
      break;
    }
    case "PLAN_MEET": {
      if (lead.scheduledMeetingAt)
        facts.push({ icon: CalendarClock, label: "Meeting", value: formatDate(lead.scheduledMeetingAt) });
      else if (lead.lastInteractionAt)
        facts.push({ icon: CalendarClock, label: "Last contact", value: formatDate(lead.lastInteractionAt) });
      break;
    }
    case "PITCHED": {
      if (lead.pitchedAt) facts.push({ icon: CalendarClock, label: "Pitched", value: formatDate(lead.pitchedAt) });
      if (lead.nextAction) facts.push({ icon: Flag, label: "Next", value: lead.nextAction });
      break;
    }
    case "PROPOSAL_SENT": {
      if (lead.proposalAmount)
        facts.push({ icon: Banknote, label: "Amount", value: formatAmount(lead.proposalAmount) });
      if (lead.expectedCloseAt)
        facts.push({ icon: Target, label: "Expected close", value: formatDate(lead.expectedCloseAt) });
      break;
    }
  }

  return facts.slice(0, 3);
}

export function LeadKanbanCard({
  lead,
  reps,
  stageOptions,
  canUpdate,
  canDelete,
}: {
  lead: LeadListRow;
  reps: Rep[];
  stageOptions: PipelineStageOption[];
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [isMoving, startMove] = useTransition();
  const [stage, setStage] = useState<LeadStage>(lead.stage);
  const stageFieldId = useId();
  const facts = stageFacts({ ...lead, stage });
  const contact = lead.email || lead.phone;

  function handleStageChange(nextStage: string | null) {
    if (!nextStage || nextStage === stage) return;
    const previousStage = stage;
    setStage(nextStage as LeadStage);
    const formData = new FormData();
    formData.set("leadId", lead.id);
    formData.set("stage", nextStage);
    startMove(async () => {
      try {
        await moveLeadStageAction(formData);
        // Previously the board moved a card silently, so there was no way to
        // tell a completed move from one that had quietly failed.
        toast.success(`${lead.name} moved to ${STAGE_LABEL[nextStage as LeadStage]}.`);
      } catch (err) {
        setStage(previousStage);
        toast.error(err instanceof Error ? err.message : "Couldn't move this lead.");
      }
    });
  }

  return (
    <Card
      size="sm"
      className={cn("transition-shadow hover:shadow-sm", isMoving && "opacity-70")}
      aria-busy={isMoving || undefined}
    >
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-1">
          <Link href={`/leads/${lead.id}`} className="min-w-0 rounded-md">
            <p className="truncate text-sm font-semibold hover:underline">{lead.name}</p>
            {lead.companyName && (
              <p className="truncate text-xs text-muted-foreground">{lead.companyName}</p>
            )}
          </Link>
          <LeadRowActions lead={lead} reps={reps} canUpdate={canUpdate} canDelete={canDelete} />
        </div>

        {contact && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {lead.email ? (
              <Mail className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <Phone className="size-3 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{contact}</span>
          </p>
        )}

        {(lead.source || lead.closingProbability != null) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {lead.source && <Badge variant="outline">{lead.source}</Badge>}
            {lead.closingProbability != null && (
              <Badge variant="secondary">{lead.closingProbability}% likely to close</Badge>
            )}
          </div>
        )}

        {facts.length > 0 && (
          <dl className="grid gap-1 border-t pt-2 text-xs">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-start gap-1.5">
                <fact.icon className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <dt className="shrink-0 text-muted-foreground">{fact.label}:</dt>
                <dd className="min-w-0 truncate font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="truncate border-t pt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{repName(lead.assignedRep)}</span>
          {lead.assignedRep ? " is responsible" : " — nobody is responsible yet"}
        </p>

        {canUpdate && (
          <div className="grid gap-1">
            {/* The move control used to be an unlabelled dropdown that just
                showed the current stage — easy to mistake for a read-only
                field. It now says what it does. */}
            <Label htmlFor={stageFieldId} className="text-[11px] font-medium text-muted-foreground">
              {isMoving ? "Moving…" : "Move to stage"}
            </Label>
            <Select value={stage} onValueChange={handleStageChange} disabled={isMoving}>
              <SelectTrigger id={stageFieldId} className="h-8 w-full text-xs">
                {isMoving && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
