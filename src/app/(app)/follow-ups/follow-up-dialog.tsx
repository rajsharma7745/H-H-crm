"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { createFollowUpAction, updateFollowUpAction } from "@/lib/actions/follow-ups";
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
import { Textarea } from "@/components/ui/textarea";
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
import { FormField, FormRow } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toDateTimeInputValue } from "@/lib/format";

type Rep = { id: string; firstName: string; lastName: string };
type LeadOption = { id: string; name: string; companyName: string | null };

export type EditableFollowUp = {
  id: string;
  leadId: string;
  title: string;
  description: string | null;
  type: "CALL" | "EMAIL" | "MEETING" | "MESSAGE" | "OTHER";
  dueAt: Date;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignedRepId: string | null;
};

export function FollowUpDialog({
  leads,
  reps,
  followUp,
  defaultLeadId,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  leads: LeadOption[];
  reps: Rep[];
  followUp?: EditableFollowUp;
  /** Pre-selects (and locks) the lead when scheduling from a lead's own page. */
  defaultLeadId?: string;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = Boolean(followUp);
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? onOpenChangeProp! : setInternalOpen;

  const lockedLeadId = followUp?.leadId ?? defaultLeadId;
  const lockedLead = lockedLeadId ? leads.find((l) => l.id === lockedLeadId) : undefined;

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prevState, formData) => {
      const result = await (isEdit ? updateFollowUpAction : createFollowUpAction)(prevState, formData);
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
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle>{isEdit ? "Edit follow-up" : "Schedule a follow-up"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change what this follow-up is for, when it is due, or who is responsible."
              : "A reminder to contact a lead at a particular time. It will appear in the follow-ups queue."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="contents">
          <TimeZoneField />
          {isEdit && <input type="hidden" name="followUpId" value={followUp!.id} />}

          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 py-5">
            {state?.error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            {lockedLeadId ? (
              <>
                <input type="hidden" name="leadId" value={lockedLeadId} />
                <div className="rounded-lg border bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Follow-up for</p>
                  <p className="text-sm font-medium">
                    {lockedLead?.name ?? "This lead"}
                    {lockedLead?.companyName ? (
                      <span className="font-normal text-muted-foreground"> · {lockedLead.companyName}</span>
                    ) : null}
                  </p>
                </div>
              </>
            ) : (
              <FormField id="followUpLeadId" label="Which lead" required>
                <Select name="leadId" defaultValue={leads[0]?.id}>
                  <SelectTrigger id="followUpLeadId" className="w-full">
                    <SelectValue placeholder="Select a lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name}
                        {lead.companyName ? ` · ${lead.companyName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            <FormField id="title" label="What needs doing" required hint="Write it as an instruction to yourself.">
              <Input
                id="title"
                name="title"
                defaultValue={followUp?.title}
                placeholder="Call back about the proposal"
                required
                maxLength={200}
              />
            </FormField>

            <FormRow>
              <FormField id="type" label="How" required>
                <Select name="type" defaultValue={followUp?.type ?? "CALL"}>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CALL">Call</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="MEETING">Meeting</SelectItem>
                    <SelectItem value="MESSAGE">Message</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="dueAt" label="Due date and time" required>
                <Input
                  id="dueAt"
                  name="dueAt"
                  type="datetime-local"
                  defaultValue={toDateTimeInputValue(followUp?.dueAt, browserTimeZone())}
                  required
                />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField id="priority" label="Priority" required>
                <Select name="priority" defaultValue={followUp?.priority ?? "MEDIUM"}>
                  <SelectTrigger id="priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              {isEdit ? (
                <FormField id="status" label="Status" required>
                  <Select name="status" defaultValue={followUp?.status ?? "PENDING"}>
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Open</SelectItem>
                      <SelectItem value="COMPLETED">Done</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              ) : (
                // A brand-new follow-up is always pending; no need to ask.
                <input type="hidden" name="status" value="PENDING" />
              )}
            </FormRow>

            <FormField
              id="followUpAssignedRepId"
              label="Who is responsible"
              hint="Leave unassigned if anyone on the team can pick it up."
            >
              <Select name="assignedRepId" defaultValue={followUp?.assignedRepId ?? UNASSIGNED_REP}>
                <SelectTrigger id="followUpAssignedRepId" className="w-full">
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

            <FormField id="description" label="Notes">
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={followUp?.description ?? ""}
                maxLength={5000}
              />
            </FormField>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 border-t px-5 py-4">
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <SubmitButton pending={isPending} pendingText={isEdit ? "Saving…" : "Scheduling…"}>
              {isEdit ? "Save changes" : "Schedule follow-up"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
