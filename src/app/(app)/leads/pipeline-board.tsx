import { Inbox, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { LeadKanbanCard } from "@/app/(app)/leads/lead-kanban-card";
import { STAGE_DOT_CLASS } from "@/app/(app)/leads/lead-stage-badge";
import type { LeadListRow } from "@/app/(app)/leads/lead-list";
import type { LeadStage } from "@prisma/client";

type Rep = { id: string; firstName: string; lastName: string };

export type PipelineStageOption = {
  value: LeadStage;
  /** The column heading. */
  label: string;
  /** One line telling a new user what this stage actually means. */
  description: string;
};

/** Per-stage accent, used for the column's top rule and its heading dot. */
const STAGE_ACCENT: Record<LeadStage, string> = {
  COLD: "border-t-stage-cold",
  WARM: "border-t-stage-warm",
  HOT: "border-t-stage-hot",
  PLAN_MEET: "border-t-stage-plan-meet",
  PITCHED: "border-t-stage-pitched",
  PROPOSAL_SENT: "border-t-stage-proposal-sent",
};

/**
 * Shared 3-column board for both pipelines.
 *
 * The board now states its own progression rather than leaving it implied by
 * column order: each column is numbered, carries its stage's colour as a top
 * rule, explains in one line what the stage means, and — unless it is the
 * last stage — names where a lead goes next. That is what turns three
 * identical grey columns into a pipeline somebody can read on their first day.
 *
 * Drag-and-drop was evaluated and deliberately skipped: no drag-and-drop
 * library is installed, the brief makes it conditional on one already working,
 * and a keyboard- and touch-accessible fallback is needed regardless. Each
 * card's labelled "Move to" control (see LeadKanbanCard) is that fallback,
 * promoted to the primary interaction.
 */
export function PipelineBoard({
  stages,
  leadsByStage,
  reps,
  canUpdate,
  canDelete,
}: {
  stages: PipelineStageOption[];
  leadsByStage: Record<string, LeadListRow[]>;
  reps: Rep[];
  canUpdate: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {stages.map((stage, index) => {
        const leads = leadsByStage[stage.value] ?? [];
        const nextStage = stages[index + 1];

        return (
          <section
            key={stage.value}
            aria-label={`${stage.label} — ${leads.length} ${leads.length === 1 ? "lead" : "leads"}`}
            className={cn(
              "flex min-w-0 flex-col rounded-xl border border-t-2 bg-muted/40",
              STAGE_ACCENT[stage.value],
            )}
          >
            <header className="border-b px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", STAGE_DOT_CLASS[stage.value])}
                    aria-hidden="true"
                  />
                  <span className="truncate">{stage.label}</span>
                </h2>
                <span className="tabular-metric shrink-0 rounded-md bg-card px-2 py-0.5 text-xs font-semibold ring-1 ring-border">
                  {leads.length}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                <span className="font-medium text-muted-foreground/90">Step {index + 1} of {stages.length}.</span>{" "}
                {stage.description}
              </p>
              {nextStage && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80">
                  <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
                  Next: {nextStage.label}
                </p>
              )}
            </header>

            <div className="flex flex-col gap-2 p-2">
              {leads.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={Inbox}
                  title="Empty"
                  description={`No leads are in ${stage.label} right now.`}
                  className="rounded-lg border border-dashed bg-card/60"
                />
              ) : (
                leads.map((lead) => (
                  <LeadKanbanCard
                    key={lead.id}
                    lead={lead}
                    reps={reps}
                    stageOptions={stages}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
