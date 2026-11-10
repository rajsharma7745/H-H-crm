"use client";

import { useId, useState } from "react";
import { MoreHorizontal, Pencil, Check, CalendarClock, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelFollowUpAction,
  completeFollowUpAction,
  rescheduleFollowUpAction,
} from "@/lib/actions/follow-ups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FollowUpDialog, type EditableFollowUp } from "@/app/(app)/follow-ups/follow-up-dialog";
import { toDateTimeInputValue } from "@/lib/format";
import { TIME_ZONE_FIELD, browserTimeZone } from "@/lib/timezone";

type Rep = { id: string; firstName: string; lastName: string };
type LeadOption = { id: string; name: string; companyName: string | null };

export function FollowUpRowActions({
  followUp,
  leads,
  reps,
  canUpdate,
}: {
  followUp: EditableFollowUp;
  leads: LeadOption[];
  reps: Rep[];
  canUpdate: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const dueFieldId = useId();

  if (!canUpdate) return null;

  async function run(fn: () => Promise<void>, successMessage: string, failureMessage: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failureMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    const formData = new FormData();
    formData.set("followUpId", followUp.id);
    await run(() => completeFollowUpAction(formData), "Follow-up marked done.", "Couldn't complete this follow-up.");
  }

  async function handleCancel() {
    const formData = new FormData();
    formData.set("followUpId", followUp.id);
    const ok = await run(() => cancelFollowUpAction(formData), "Follow-up cancelled.", "Couldn't cancel this follow-up.");
    if (ok) setCancelOpen(false);
  }

  async function handleReschedule() {
    const formData = new FormData();
    formData.set("followUpId", followUp.id);
    formData.set("dueAt", dueAt);
    formData.set(TIME_ZONE_FIELD, browserTimeZone());
    const ok = await run(
      () => rescheduleFollowUpAction(formData),
      "Follow-up rescheduled.",
      "Couldn't reschedule this follow-up.",
    );
    if (ok) setRescheduleOpen(false);
  }

  const showComplete = followUp.status !== "COMPLETED";
  const showCancel = followUp.status === "PENDING";

  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      {/*
        "Mark done" is the action people take dozens of times a day, so it is a
        visible button rather than the third item in a hidden menu. Reschedule,
        Edit and Cancel stay in the menu — they are occasional by comparison.
      */}
      {showComplete && (
        <Button variant="outline" size="sm" onClick={handleComplete} disabled={busy}>
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-3.5" aria-hidden="true" />
          )}
          Done
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={`More actions for "${followUp.title}"`}>
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              // Computed on open in the browser zone — render also runs on the server.
              setDueAt(toDateTimeInputValue(followUp.dueAt, browserTimeZone()));
              setRescheduleOpen(true);
            }}
          >
            <CalendarClock className="size-4" />
            Reschedule
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit details
          </DropdownMenuItem>
          {showCancel && (
            <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
              <Ban className="size-4" />
              Cancel follow-up
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <FollowUpDialog
        leads={leads}
        reps={reps}
        followUp={followUp}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule this follow-up</DialogTitle>
            <DialogDescription>
              Pick a new date and time. Rescheduling reopens a follow-up that was already done or cancelled.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={dueFieldId}>
              New due date and time <span className="text-destructive">*</span>
            </Label>
            <Input
              id={dueFieldId}
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={busy || !dueAt}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {busy ? "Saving…" : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel &ldquo;{followUp.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              It stays on the lead&apos;s record marked as cancelled — nothing is deleted, and you can reschedule
              it later to reopen it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={busy}>
              {busy ? "Cancelling…" : "Cancel follow-up"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
