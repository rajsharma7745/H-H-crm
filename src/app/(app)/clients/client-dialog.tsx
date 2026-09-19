"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { createClientAction, updateClientAction } from "@/lib/actions/clients";
import type { ActionState } from "@/lib/actions/auth";
import { UNASSIGNED_OWNER } from "@/lib/validation";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type Owner = { id: string; firstName: string; lastName: string };

export type EditableClient = {
  id: string;
  name: string;
  clientType: "B2B" | "B2C";
  status: "PROSPECT" | "ACTIVE" | "PAUSED" | "CHURNED";
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  website: string | null;
  industry: string | null;
  address: string | null;
  notes: string | null;
  ownerId: string | null;
};

export function ClientDialog({
  owners,
  client,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  owners: Owner[];
  client?: EditableClient;
  /** Uncontrolled usage (e.g. the "Add client" button): renders its own trigger. */
  trigger?: React.ReactElement;
  /** Controlled usage (e.g. opened from a dropdown menu item): omit `trigger`
   * and drive `open`/`onOpenChange` externally instead — nesting a Dialog
   * trigger inside a Menu Item breaks the menu item's own ref/role
   * registration in Base UI, so row actions must use this mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = Boolean(client);
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? onOpenChangeProp! : setInternalOpen;
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (prevState, formData) => {
      const result = await (isEdit ? updateClientAction : createClientAction)(prevState, formData);
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
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "Add client"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this client's details."
              : "Add a new client record. You can fill in more details later."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid max-h-[70vh] gap-4 overflow-y-auto px-1">
          {isEdit && <input type="hidden" name="clientId" value={client!.id} />}

          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="name">Client / company name</Label>
            <Input id="name" name="name" defaultValue={client?.name} required maxLength={200} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="clientType">Client type</Label>
              <Select name="clientType" defaultValue={client?.clientType ?? "B2B"}>
                <SelectTrigger id="clientType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2B">B2B</SelectItem>
                  <SelectItem value="B2C">B2C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={client?.status ?? "PROSPECT"}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROSPECT">Prospect</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="CHURNED">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="primaryContactName">Primary contact</Label>
              <Input
                id="primaryContactName"
                name="primaryContactName"
                defaultValue={client?.primaryContactName ?? ""}
                maxLength={150}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="primaryContactPhone">Contact phone</Label>
              <Input
                id="primaryContactPhone"
                name="primaryContactPhone"
                defaultValue={client?.primaryContactPhone ?? ""}
                maxLength={30}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="primaryContactEmail">Contact email</Label>
            <Input
              id="primaryContactEmail"
              name="primaryContactEmail"
              type="email"
              defaultValue={client?.primaryContactEmail ?? ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                placeholder="https://"
                defaultValue={client?.website ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" defaultValue={client?.industry ?? ""} maxLength={100} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Address / location</Label>
            <Input id="address" name="address" defaultValue={client?.address ?? ""} maxLength={300} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ownerId">Owner</Label>
            <Select name="ownerId" defaultValue={client?.ownerId ?? UNASSIGNED_OWNER}>
              <SelectTrigger id="ownerId" className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_OWNER}>Unassigned</SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.firstName} {owner.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} maxLength={5000} />
          </div>

          <DialogFooter className="sticky bottom-0 mt-2 bg-popover pt-2">
            <SubmitButton pendingText={isEdit ? "Saving..." : "Adding..."}>
              {isEdit ? "Save changes" : "Add client"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
