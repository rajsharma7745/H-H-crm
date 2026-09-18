"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { activateUserAction, deactivateUserAction } from "@/lib/actions/users";
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
import { UserDialog } from "@/app/(app)/admin/users/user-dialog";

type Role = { id: string; name: string };
type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  jobTitle: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export function UserRowActions({
  user,
  roles,
  canUpdate,
  canDeactivate,
  isSelf,
}: {
  user: Row;
  roles: Role[];
  canUpdate: boolean;
  canDeactivate: boolean;
  isSelf: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function handleDeactivate() {
    const formData = new FormData();
    formData.set("userId", user.id);
    try {
      await deactivateUserAction(formData);
      toast.success(`${user.firstName} was deactivated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't deactivate this user.");
    }
    setConfirmOpen(false);
  }

  async function handleActivate() {
    const formData = new FormData();
    formData.set("userId", user.id);
    try {
      await activateUserAction(formData);
      toast.success(`${user.firstName} was reactivated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reactivate this user.");
    }
  }

  if (!canUpdate && !canDeactivate) return null;

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
          {canUpdate && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
          )}
          {canDeactivate && user.status === "ACTIVE" && !isSelf && (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
              <UserX className="size-4" />
              Deactivate
            </DropdownMenuItem>
          )}
          {canUpdate && user.status === "INACTIVE" && (
            <DropdownMenuItem onClick={handleActivate}>
              <UserCheck className="size-4" />
              Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canUpdate && (
        <UserDialog roles={roles} user={user} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {user.firstName} {user.lastName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be signed out immediately and won&apos;t be able to log back in until
              reactivated.
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
