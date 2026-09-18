"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { createUserAction, updateUserAction } from "@/lib/actions/users";
import type { ActionState } from "@/lib/actions/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type Role = { id: string; name: string };

type EditableUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  jobTitle: string | null;
  phone: string | null;
};

export function UserDialog({
  roles,
  user,
  trigger,
}: {
  roles: Role[];
  user?: EditableUser;
  trigger: React.ReactElement;
}) {
  const isEdit = Boolean(user);
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (prevState, formData) => {
      const result = await (isEdit ? updateUserAction : createUserAction)(prevState, formData);
      if (result?.success) {
        toast.success(result.success);
        setOpen(false);
      }
      return result;
    },
    undefined,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "Create user"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this person's details or role."
              : "They'll sign in with the email and temporary password below."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-4">
          {isEdit && <input type="hidden" name="userId" value={user!.id} />}

          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" defaultValue={user?.firstName} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" defaultValue={user?.lastName} required />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={user?.email}
              disabled={isEdit}
              required={!isEdit}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">Email can&apos;t be changed after creation.</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="roleId">Role</Label>
            <Select name="roleId" defaultValue={user?.roleId}>
              <SelectTrigger id="roleId" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" name="jobTitle" defaultValue={user?.jobTitle ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={user?.phone ?? ""} />
            </div>
          </div>

          {!isEdit && (
            <>
              <PasswordInput
                label="Temporary password"
                name="temporaryPassword"
                autoComplete="new-password"
                required
              />
              <p className="-mt-2 text-xs text-muted-foreground">
                They should change this after signing in. At least 10 characters, with a letter
                and a number or symbol.
              </p>
            </>
          )}

          <DialogFooter className="mt-2">
            <SubmitButton pendingText={isEdit ? "Saving..." : "Creating..."}>
              {isEdit ? "Save changes" : "Create user"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
