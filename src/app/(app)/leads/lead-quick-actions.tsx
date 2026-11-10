"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignLeadAction, moveLeadStageAction } from "@/lib/actions/leads";
import { UNASSIGNED_REP } from "@/lib/validation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Rep = { id: string; firstName: string; lastName: string };
type StageOption = { value: string; label: string };

/**
 * The lead detail page's "change stage" and "assign representative" quick
 * actions. Both write through the narrow server actions rather than the full
 * edit form, so a one-field change is a one-field request.
 */
export function LeadQuickActions({
  leadId,
  stage,
  assignedRepId,
  stageOptions,
  reps,
}: {
  leadId: string;
  stage: string;
  assignedRepId: string | null;
  stageOptions: StageOption[];
  reps: Rep[];
}) {
  const [pending, startTransition] = useTransition();
  const [currentStage, setCurrentStage] = useState(stage);
  const [currentRepId, setCurrentRepId] = useState(assignedRepId ?? UNASSIGNED_REP);

  function handleStageChange(next: string | null) {
    if (!next || next === currentStage) return;
    const previous = currentStage;
    setCurrentStage(next);
    const formData = new FormData();
    formData.set("leadId", leadId);
    formData.set("stage", next);
    startTransition(async () => {
      try {
        await moveLeadStageAction(formData);
        toast.success("Stage updated.");
      } catch (err) {
        setCurrentStage(previous);
        toast.error(err instanceof Error ? err.message : "Couldn't change the stage.");
      }
    });
  }

  function handleRepChange(next: string | null) {
    if (!next || next === currentRepId) return;
    const previous = currentRepId;
    setCurrentRepId(next);
    const formData = new FormData();
    formData.set("leadId", leadId);
    formData.set("assignedRepId", next);
    startTransition(async () => {
      try {
        await assignLeadAction(formData);
        toast.success(next === UNASSIGNED_REP ? "Lead unassigned." : "Lead reassigned.");
      } catch (err) {
        setCurrentRepId(previous);
        toast.error(err instanceof Error ? err.message : "Couldn't reassign this lead.");
      }
    });
  }

  return (
    <div className="grid gap-3" aria-busy={pending || undefined}>
      <div className="grid gap-1.5">
        <Label htmlFor="quickStage" className="text-xs font-medium text-muted-foreground">
          Move to stage
        </Label>
        <Select value={currentStage} onValueChange={handleStageChange} disabled={pending}>
          <SelectTrigger id="quickStage" className="w-full">
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

      <div className="grid gap-1.5">
        <Label htmlFor="quickRep" className="text-xs font-medium text-muted-foreground">
          Reassign to
        </Label>
        <Select value={currentRepId} onValueChange={handleRepChange} disabled={pending}>
          <SelectTrigger id="quickRep" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED_REP}>Unassigned</SelectItem>
            {reps.map((rep) => (
              <SelectItem key={rep.id} value={rep.id}>
                {rep.firstName} {rep.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
