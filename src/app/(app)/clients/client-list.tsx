import Link from "next/link";
import { Building2, Mail, Phone } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientStatusBadge } from "@/app/(app)/clients/client-status-badge";
import { ClientRowActions } from "@/app/(app)/clients/client-row-actions";
import type { EditableClient } from "@/app/(app)/clients/client-dialog";

type Owner = { id: string; firstName: string; lastName: string };

export type ClientListRow = EditableClient & {
  updatedAt: Date;
  owner: { id: string; firstName: string; lastName: string } | null;
};

function formatUpdated(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ClientList({
  clients,
  owners,
  canUpdate,
  canDeactivate,
}: {
  clients: ClientListRow[];
  owners: Owner[];
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Primary contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link href={`/clients/${client.id}`} className="block min-w-0">
                    <p className="truncate text-sm font-medium hover:underline">{client.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {client.clientType}
                      {client.industry ? ` · ${client.industry}` : ""}
                    </p>
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="truncate text-sm">{client.primaryContactName || "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {client.primaryContactEmail || client.primaryContactPhone || ""}
                  </p>
                </TableCell>
                <TableCell>
                  <ClientStatusBadge status={client.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {client.owner ? `${client.owner.firstName} ${client.owner.lastName}` : "Unassigned"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatUpdated(client.updatedAt)}
                </TableCell>
                <TableCell>
                  <ClientRowActions
                    client={client}
                    owners={owners}
                    canUpdate={canUpdate}
                    canDeactivate={canDeactivate}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards, no horizontal scroll */}
      <div className="grid gap-3 md:hidden">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/clients/${client.id}`} className="min-w-0">
                  <p className="truncate text-sm font-medium hover:underline">{client.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="size-3" />
                    {client.clientType}
                    {client.industry ? ` · ${client.industry}` : ""}
                  </p>
                </Link>
                <ClientRowActions
                  client={client}
                  owners={owners}
                  canUpdate={canUpdate}
                  canDeactivate={canDeactivate}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <ClientStatusBadge status={client.status} />
                <Badge variant="outline">
                  {client.owner ? `${client.owner.firstName} ${client.owner.lastName}` : "Unassigned"}
                </Badge>
              </div>

              {(client.primaryContactEmail || client.primaryContactPhone) && (
                <div className="grid gap-1 text-xs text-muted-foreground">
                  {client.primaryContactEmail && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5 shrink-0" />
                      <span className="truncate">{client.primaryContactEmail}</span>
                    </span>
                  )}
                  {client.primaryContactPhone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5 shrink-0" />
                      {client.primaryContactPhone}
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">Updated {formatUpdated(client.updatedAt)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
