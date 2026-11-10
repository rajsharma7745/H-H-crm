"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { createLeadActivityAction, updateLeadActivityAction } from "@/lib/actions/lead-activities";
import type { ActionState } from "@/lib/actions/auth";
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
import { nowDateTimeInputValue, toDateTimeInputValue } from "@/lib/format";

export type EditableLeadActivity = {
  id: string;
  leadId: string;
  type: "NOTE" | "CALL" | "MEETING" | "EMAIL" | "OTHER";
  title: string;
  description: string | null;
  activityAt: Date;
};

export function LeadActivityDialog({
  leadId,
  activity,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  leadId: string;
  activity?: EditableLeadActivity;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = Boolean(activity);
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? onOpenChangeProp! : setInternalOpen;

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prevState, formData) => {
      const result = await (isEdit ? updateLeadActivityAction : createLeadActivityAction)(prevState, formData);
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
          <DialogTitle>{isEdit ? "Edit this entry" : "Log an activity"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change this entry in the lead's history."
              : "Record something that already happened — a call, a note, a meeting or an email. It goes straight onto the lead's timeline."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="contents">
          <TimeZoneField />
          <input type="hidden" name="leadId" value={leadId} />
          {isEdit && <input type="hidden" name="activityId" value={activity!.id} />}

          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 py-5">
            {state?.error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <FormRow>
              <FormField id="activityType" label="What kind" required>
                <Select name="type" defaultValue={activity?.type ?? "NOTE"}>
                  <SelectTrigger id="activityType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOTE">Note</SelectItem>
                    <SelectItem value="CALL">Call</SelectItem>
                    <SelectItem value="MEETING">Meeting</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="activityAt" label="When it happened" required>
                <Input
                  id="activityAt"
                  name="activityAt"
                  type="datetime-local"
                  defaultValue={
                    activity
                      ? toDateTimeInputValue(activity.activityAt, browserTimeZone())
                      : nowDateTimeInputValue(browserTimeZone())
                  }
                  required
                />
              </FormField>
            </FormRow>

            <FormField id="activityTitle" label="Summary" required hint="One line — this is what the timeline shows.">
              <Input
                id="activityTitle"
                name="title"
                defaultValue={activity?.title}
                placeholder="Spoke about budget and timelines"
                required
                maxLength={200}
              />
            </FormField>

            <FormField id="activityDescription" label="Details">
              <Textarea
                id="activityDescription"
                name="description"
                rows={4}
                defaultValue={activity?.description ?? ""}
                maxLength={5000}
              />
            </FormField>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 border-t px-5 py-4">
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <SubmitButton pending={isPending} pendingText={isEdit ? "Saving…" : "Logging…"}>
              {isEdit ? "Save changes" : "Log activity"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
