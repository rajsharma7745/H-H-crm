"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, RotateCcw, Ban } from "lucide-react";
import { toast } from "sonner";
import { activateClientAction, deactivateClientAction } from "@/lib/actions/clients";
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
import { ClientDialog, type EditableClient } from "@/app/(app)/clients/client-dialog";

type Owner = { id: string; firstName: string; lastName: string };

export function ClientRowActions({
  client,
  owners,
  canUpdate,
  canDeactivate,
}: {
  client: EditableClient & { owner?: Owner | null };
  owners: Owner[];
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // The owner picker only lists ACTIVE users (you shouldn't be able to
  // *assign* a deactivated employee) — but if this client's current owner
  // has since been deactivated, that owner won't be in that list. Without
  // this, the Select would silently fall back to showing "Unassigned" for a
  // client that still has a real owner, inviting an accidental unassignment.
  const editDialogOwners =
    client.owner && !owners.some((o) => o.id === client.owner!.id)
      ? [...owners, { ...client.owner, lastName: `${client.owner.lastName} (inactive)` }]
      : owners;

  async function handleDeactivate() {
    const formData = new FormData();
    formData.set("clientId", client.id);
    try {
      await deactivateClientAction(formData);
      toast.success(`${client.name} was marked churned.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't deactivate this client.");
    }
    setConfirmOpen(false);
  }

  async function handleActivate() {
    const formData = new FormData();
    formData.set("clientId", client.id);
    try {
      await activateClientAction(formData);
      toast.success(`${client.name} was marked active.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reactivate this client.");
    }
  }

  // Computed per-item (not just per-permission) so a user who e.g. only has
  // clients.delete never gets a "..." trigger that opens on an empty menu —
  // which would otherwise happen for a CHURNED client, since Deactivate
  // hides itself there and Reactivate needs clients.update.
  const showEdit = canUpdate;
  const showDeactivate = canDeactivate && client.status !== "CHURNED";
  const showActivate = canUpdate && client.status !== "ACTIVE";

  if (!showEdit && !showDeactivate && !showActivate) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {showEdit && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
          )}
          {showDeactivate && (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Ban className="size-4" />
              Deactivate
            </DropdownMenuItem>
          )}
          {showActivate && (
            <DropdownMenuItem onClick={handleActivate}>
              <RotateCcw className="size-4" />
              {client.status === "CHURNED" ? "Reactivate" : "Mark active"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canUpdate && (
        <ClientDialog owners={editDialogOwners} client={client} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {client.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the client as Churned. You can reactivate them at any time from this
              same menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
