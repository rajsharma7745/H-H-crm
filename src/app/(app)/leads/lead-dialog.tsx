"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { createLeadAction, updateLeadAction } from "@/lib/actions/leads";
import type { ActionState } from "@/lib/actions/auth";
import { UNASSIGNED_REP } from "@/lib/validation";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { TimeZoneField } from "@/components/timezone";
import { usePreservedSubmit } from "@/components/use-preserved-submit";
import { browserTimeZone } from "@/lib/timezone";
import { FormField, FormRow, FormSection } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toDateInputValue, toDateTimeInputValue } from "@/lib/format";

type Rep = { id: string; firstName: string; lastName: string };
type Pipeline = "ADS" | "WARM_APPROACH";
type Stage = "COLD" | "WARM" | "HOT" | "PLAN_MEET" | "PITCHED" | "PROPOSAL_SENT";

const STAGE_OPTIONS: Record<Pipeline, { value: Stage; label: string }[]> = {
  ADS: [
    { value: "COLD", label: "Cold" },
    { value: "WARM", label: "Warm" },
    { value: "HOT", label: "Hot" },
  ],
  WARM_APPROACH: [
    { value: "PLAN_MEET", label: "Plan Meet" },
    { value: "PITCHED", label: "Pitched" },
    { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  ],
};

export type EditableLead = {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  pipeline: Pipeline;
  stage: Stage;
  source: string | null;
  notes: string | null;
  assignedRepId: string | null;
  campaignName: string | null;
  adCreative: string | null;
  submittedAt: Date | null;
  initialContactStatus: string | null;
  interestLevel: string | null;
  qualificationNotes: string | null;
  lastContactedAt: Date | null;
  immediateRequirement: string | null;
  closingProbability: number | null;
  meetingScheduled: boolean;
  lastInteractionAt: Date | null;
  scheduledMeetingAt: Date | null;
  followUpNotes: string | null;
  pitchedAt: Date | null;
  serviceDiscussed: string | null;
  feedback: string | null;
  nextAction: string | null;
  proposalAmount: string | null;
  proposalDocUrl: string | null;
  proposalSentAt: Date | null;
  expectedCloseAt: Date | null;
  outcome: "WON" | "LOST" | null;
};

export function LeadDialog({
  reps,
  lead,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  defaultPipeline,
}: {
  reps: Rep[];
  lead?: EditableLead;
  /** Uncontrolled usage (e.g. the "Add lead" button): renders its own trigger. */
  trigger?: React.ReactElement;
  /** Controlled usage (e.g. opened from a dropdown menu item): omit `trigger`
   * and drive `open`/`onOpenChange` externally — mirrors ClientDialog. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pre-selects a pipeline for a *new* lead — used when "Add lead" is
   * opened from /leads/ads or /leads/warm-approach. Ignored when editing an
   * existing lead, which already has its own pipeline. */
  defaultPipeline?: Pipeline;
}) {
  const isEdit = Boolean(lead);
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? onOpenChangeProp! : setInternalOpen;

  const [pipeline, setPipeline] = useState<Pipeline>(lead?.pipeline ?? defaultPipeline ?? "ADS");
  const [stage, setStage] = useState<Stage>(lead?.stage ?? STAGE_OPTIONS[lead?.pipeline ?? defaultPipeline ?? "ADS"][0].value);

  function handlePipelineChange(next: Pipeline) {
    setPipeline(next);
    // A stage from the previous pipeline is never valid for the new one —
    // reset to that pipeline's first stage rather than leaving a mismatch
    // for the server's pipeline-aware validation to reject.
    setStage(STAGE_OPTIONS[next][0].value);
  }

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prevState, formData) => {
      const result = await (isEdit ? updateLeadAction : createLeadAction)(prevState, formData);
      if (result?.success) {
        toast.success(result.success);
        setOpen(false);
      }
      return result;
    },
    undefined,
  );
  const handleSubmit = usePreservedSubmit(formAction);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle>{isEdit ? `Edit ${lead!.name}` : "Add a lead"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change this lead's details. Only the lead name is required."
              : "Only the lead name is required — you can fill in the rest as you learn it."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="contents">
          <TimeZoneField />
          {isEdit && <input type="hidden" name="leadId" value={lead!.id} />}

          {/*
            The form body scrolls inside a fixed-height dialog, so the title and
            the Save button both stay visible on a long form and on a phone —
            previously the footer scrolled with the fields on small screens.
          */}
          <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-5 py-5">
            {state?.error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <FormSection title="Who they are">
              <FormField id="name" label="Lead name" required hint="A person or a business — whatever you know them by.">
                <Input id="name" name="name" defaultValue={lead?.name} required maxLength={200} autoComplete="off" />
              </FormField>

              <FormRow>
                <FormField id="companyName" label="Company">
                  <Input
                    id="companyName"
                    name="companyName"
                    defaultValue={lead?.companyName ?? ""}
                    maxLength={200}
                    autoComplete="off"
                  />
                </FormField>
                <FormField id="source" label="Where they came from" hint="For example: Instagram ad, referral, walk-in.">
                  <Input
                    id="source"
                    name="source"
                    defaultValue={lead?.source ?? ""}
                    maxLength={150}
                    autoComplete="off"
                  />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField id="email" label="Email">
                  <Input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} autoComplete="off" />
                </FormField>
                <FormField id="phone" label="Phone">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={lead?.phone ?? ""}
                    maxLength={30}
                    autoComplete="off"
                  />
                </FormField>
              </FormRow>
            </FormSection>

            <FormSection
              title="Where they sit"
              description="The pipeline decides which stages are available and which details are recorded below."
            >
              <FormRow>
                <FormField id="pipeline" label="Pipeline" required>
                  <Select
                    name="pipeline"
                    value={pipeline}
                    onValueChange={(v) => v && handlePipelineChange(v as Pipeline)}
                  >
                    <SelectTrigger id="pipeline" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADS">Ads — came from a campaign</SelectItem>
                      <SelectItem value="WARM_APPROACH">Warm Approach — you contacted them</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id="stage" label="Stage" required>
                  <Select name="stage" value={stage} onValueChange={(v) => setStage(v as Stage)}>
                    <SelectTrigger id="stage" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_OPTIONS[pipeline].map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </FormRow>

              <FormField
                id="assignedRepId"
                label="Who is responsible"
                hint="Leave unassigned if you have not decided yet."
              >
                <Select name="assignedRepId" defaultValue={lead?.assignedRepId ?? UNASSIGNED_REP}>
                  <SelectTrigger id="assignedRepId" className="w-full">
                    <SelectValue placeholder="Unassigned" />
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
              </FormField>
            </FormSection>

            {pipeline === "ADS" && (
              <FormSection
                title="Ads pipeline details"
                description="All optional — fill in what you know as the lead progresses."
              >
                <FormRow>
                  <FormField id="campaignName" label="Campaign name">
                    <Input
                      id="campaignName"
                      name="campaignName"
                      defaultValue={lead?.campaignName ?? ""}
                      maxLength={200}
                    />
                  </FormField>
                  <FormField id="adCreative" label="Ad creative / ad set">
                    <Input id="adCreative" name="adCreative" defaultValue={lead?.adCreative ?? ""} maxLength={200} />
                  </FormField>
                </FormRow>

                <FormRow>
                  <FormField id="submittedAt" label="Enquiry submitted on">
                    <Input
                      id="submittedAt"
                      name="submittedAt"
                      type="date"
                      defaultValue={toDateInputValue(lead?.submittedAt)}
                    />
                  </FormField>
                  <FormField id="initialContactStatus" label="Initial contact status">
                    <Input
                      id="initialContactStatus"
                      name="initialContactStatus"
                      defaultValue={lead?.initialContactStatus ?? ""}
                      maxLength={150}
                    />
                  </FormField>
                </FormRow>

                <FormRow>
                  <FormField id="interestLevel" label="Interest level">
                    <Input
                      id="interestLevel"
                      name="interestLevel"
                      defaultValue={lead?.interestLevel ?? ""}
                      maxLength={150}
                    />
                  </FormField>
                  <FormField id="lastContactedAt" label="Last communication">
                    <Input
                      id="lastContactedAt"
                      name="lastContactedAt"
                      type="date"
                      defaultValue={toDateInputValue(lead?.lastContactedAt)}
                    />
                  </FormField>
                </FormRow>

                <FormField id="immediateRequirement" label="What they need right now">
                  <Input
                    id="immediateRequirement"
                    name="immediateRequirement"
                    defaultValue={lead?.immediateRequirement ?? ""}
                    maxLength={500}
                  />
                </FormField>

                <FormField id="qualificationNotes" label="Qualification notes">
                  <Textarea
                    id="qualificationNotes"
                    name="qualificationNotes"
                    rows={3}
                    defaultValue={lead?.qualificationNotes ?? ""}
                    maxLength={5000}
                  />
                </FormField>

                <FormRow>
                  <FormField
                    id="closingProbability"
                    label="Chance of closing (%)"
                    hint="A whole number between 0 and 100."
                  >
                    <Input
                      id="closingProbability"
                      name="closingProbability"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      defaultValue={lead?.closingProbability ?? ""}
                    />
                  </FormField>
                  <div className="flex items-center gap-2.5 sm:pt-7">
                    <Checkbox id="meetingScheduled" name="meetingScheduled" defaultChecked={lead?.meetingScheduled} />
                    <Label htmlFor="meetingScheduled" className="text-sm font-normal">
                      A meeting or call is booked
                    </Label>
                  </div>
                </FormRow>
              </FormSection>
            )}

            {pipeline === "WARM_APPROACH" && (
              <FormSection
                title="Warm Approach pipeline details"
                description="All optional — fill in what you know as the lead progresses."
              >
                <FormRow>
                  <FormField id="lastInteractionAt" label="Last interaction">
                    <Input
                      id="lastInteractionAt"
                      name="lastInteractionAt"
                      type="date"
                      defaultValue={toDateInputValue(lead?.lastInteractionAt)}
                    />
                  </FormField>
                  <FormField id="scheduledMeetingAt" label="Meeting booked for">
                    <Input
                      id="scheduledMeetingAt"
                      name="scheduledMeetingAt"
                      type="datetime-local"
                      defaultValue={toDateTimeInputValue(lead?.scheduledMeetingAt, browserTimeZone())}
                    />
                  </FormField>
                </FormRow>

                <FormRow>
                  <FormField id="pitchedAt" label="Pitched on">
                    <Input
                      id="pitchedAt"
                      name="pitchedAt"
                      type="date"
                      defaultValue={toDateInputValue(lead?.pitchedAt)}
                    />
                  </FormField>
                  <FormField id="serviceDiscussed" label="Service or product discussed">
                    <Input
                      id="serviceDiscussed"
                      name="serviceDiscussed"
                      defaultValue={lead?.serviceDiscussed ?? ""}
                      maxLength={300}
                    />
                  </FormField>
                </FormRow>

                <FormField id="followUpNotes" label="Follow-up notes">
                  <Textarea
                    id="followUpNotes"
                    name="followUpNotes"
                    rows={3}
                    defaultValue={lead?.followUpNotes ?? ""}
                    maxLength={5000}
                  />
                </FormField>

                <FormField id="feedback" label="Feedback or objections">
                  <Textarea
                    id="feedback"
                    name="feedback"
                    rows={3}
                    defaultValue={lead?.feedback ?? ""}
                    maxLength={5000}
                  />
                </FormField>

                <FormField id="nextAction" label="Next action">
                  <Input id="nextAction" name="nextAction" defaultValue={lead?.nextAction ?? ""} maxLength={500} />
                </FormField>

                <FormRow>
                  <FormField id="proposalAmount" label="Proposal amount">
                    <Input
                      id="proposalAmount"
                      name="proposalAmount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      defaultValue={lead?.proposalAmount ?? ""}
                    />
                  </FormField>
                  <FormField id="proposalDocUrl" label="Link to the proposal">
                    <Input
                      id="proposalDocUrl"
                      name="proposalDocUrl"
                      type="url"
                      placeholder="https://"
                      defaultValue={lead?.proposalDocUrl ?? ""}
                    />
                  </FormField>
                </FormRow>

                <FormRow>
                  <FormField id="proposalSentAt" label="Proposal sent on">
                    <Input
                      id="proposalSentAt"
                      name="proposalSentAt"
                      type="date"
                      defaultValue={toDateInputValue(lead?.proposalSentAt)}
                    />
                  </FormField>
                  <FormField id="expectedCloseAt" label="Expected to close on">
                    <Input
                      id="expectedCloseAt"
                      name="expectedCloseAt"
                      type="date"
                      defaultValue={toDateInputValue(lead?.expectedCloseAt)}
                    />
                  </FormField>
                </FormRow>

                <FormField id="outcome" label="Outcome" hint="Leave as undecided until the deal is actually settled.">
                  <Select name="outcome" defaultValue={lead?.outcome ?? "undecided"}>
                    <SelectTrigger id="outcome" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="undecided">Still undecided</SelectItem>
                      <SelectItem value="WON">Won</SelectItem>
                      <SelectItem value="LOST">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </FormSection>
            )}

            <FormField id="notes" label="General notes">
              <Textarea id="notes" name="notes" rows={3} defaultValue={lead?.notes ?? ""} maxLength={5000} />
            </FormField>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 border-t px-5 py-4">
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <SubmitButton pending={isPending} pendingText={isEdit ? "Saving…" : "Adding…"}>
              {isEdit ? "Save changes" : "Add lead"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
