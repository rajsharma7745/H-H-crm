"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { deleteLeadAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { LeadDialog, type EditableLead } from "@/app/(app)/leads/lead-dialog";

type Rep = { id: string; firstName: string; lastName: string };

export function LeadRowActions({
  lead,
  reps,
  canUpdate,
  canDelete,
  /** After a delete from the detail page there's nowhere left to render —
   * navigate back to the list instead of just refreshing in place. */
  redirectOnDeleteTo,
}: {
  lead: EditableLead & { assignedRep?: Rep | null };
  reps: Rep[];
  canUpdate: boolean;
  canDelete: boolean;
  redirectOnDeleteTo?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The rep picker only lists ACTIVE users — if this lead's current rep has
  // since been deactivated, add them back so the edit dialog doesn't
  // silently show "Unassigned" for a lead that still has a real rep
  // (mirrors ClientRowActions' handling of a deactivated owner).
  const editDialogReps =
    lead.assignedRep && !reps.some((r) => r.id === lead.assignedRep!.id)
      ? [...reps, { ...lead.assignedRep, lastName: `${lead.assignedRep.lastName} (inactive)` }]
      : reps;

  async function handleDelete() {
    setDeleting(true);
    const formData = new FormData();
    formData.set("leadId", lead.id);
    try {
      await deleteLeadAction(formData);
      toast.success(`${lead.name} was permanently deleted.`);
      setConfirmOpen(false);
      if (redirectOnDeleteTo) router.push(redirectOnDeleteTo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete this lead.");
    } finally {
      setDeleting(false);
    }
  }

  if (!canUpdate && !canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={`More actions for ${lead.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {canUpdate && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit lead
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="size-4" />
              Delete lead
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canUpdate && (
        <LeadDialog reps={editDialogReps} lead={lead} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* A destructive confirmation should look destructive before it is
                read, not only after. */}
            <span className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4.5" aria-hidden="true" />
            </span>
            <AlertDialogTitle>Delete {lead.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the lead, its pipeline details, its logged activity and its
              follow-ups. It cannot be undone and there is no way to recover it afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
