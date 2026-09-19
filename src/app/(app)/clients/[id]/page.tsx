import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Mail,
  MapPin,
  Phone,
  StickyNote,
  User as UserIcon,
  FolderKanban,
  ListChecks,
  FileText,
  Clock,
  UsersRound,
} from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission, userHasPermission } from "@/lib/rbac/authorize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { ClientStatusBadge } from "@/app/(app)/clients/client-status-badge";
import { ClientRowActions } from "@/app/(app)/clients/client-row-actions";
import type { AuditAction } from "@prisma/client";

const FUTURE_MODULES = [
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "files", label: "Files", icon: FileText },
  { key: "time", label: "Time", icon: Clock },
  { key: "team", label: "Team", icon: UsersRound },
] as const;

const ACTIVITY_LABEL: Partial<Record<AuditAction, string>> = {
  CLIENT_CREATED: "created this client",
  CLIENT_UPDATED: "updated client details",
  CLIENT_ACTIVATED: "marked this client active",
  CLIENT_DEACTIVATED: "deactivated this client",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // Metadata resolves independently of the page body, so it needs its own
  // authorization check — otherwise an unauthorized signed-in user could see
  // a client's real name in the page <title> even though the page body
  // redirects them to /unauthorized.
  await requirePermission("clients.view");
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id }, select: { name: true } });
  return { title: client?.name ?? "Client" };
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requirePermission("clients.view");
  const { id } = await params;

  // `owners` has no dependency on `client`, so fetch them together instead
  // of paying an extra sequential round trip. `activity` does depend on
  // client.id, so it can only start once client resolves.
  const [client, owners] = await Promise.all([
    db.client.findUnique({
      where: { id },
      include: { owner: { select: { id: true, firstName: true, lastName: true } } },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  if (!client) notFound();

  const canUpdate = userHasPermission(currentUser, "clients.update");
  const canDeactivate = userHasPermission(currentUser, "clients.delete");

  const activity = await db.auditLog.findMany({
    where: {
      action: { in: ["CLIENT_CREATED", "CLIENT_UPDATED", "CLIENT_ACTIVATED", "CLIENT_DEACTIVATED"] },
      metadata: { path: ["clientId"], equals: client.id },
    },
    include: { actor: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Clients
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <ClientStatusBadge status={client.status} />
            <Badge variant="outline">{client.clientType}</Badge>
          </div>
          {(client.primaryContactName || client.primaryContactEmail || client.primaryContactPhone) && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {[client.primaryContactName, client.primaryContactEmail, client.primaryContactPhone]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        <ClientRowActions
          client={client}
          owners={owners}
          canUpdate={canUpdate}
          canDeactivate={canDeactivate}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Website</p>
                {client.website ? (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {client.website}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <UserIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Industry</p>
                <p className="text-sm font-medium">{client.industry || "Not set"}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Contact email</p>
                {client.primaryContactEmail ? (
                  <a href={`mailto:${client.primaryContactEmail}`} className="text-sm font-medium hover:underline">
                    {client.primaryContactEmail}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Contact phone</p>
                {client.primaryContactPhone ? (
                  <a href={`tel:${client.primaryContactPhone}`} className="text-sm font-medium hover:underline">
                    {client.primaryContactPhone}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Address / location</p>
                <p className="text-sm font-medium">{client.address || "Not set"}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 sm:col-span-2">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap text-sm">{client.notes || "No notes yet."}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Owner</CardTitle>
          </CardHeader>
          <CardContent>
            {client.owner ? (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="text-xs">
                    {`${client.owner.firstName[0] ?? ""}${client.owner.lastName[0] ?? ""}`.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium">
                  {client.owner.firstName} {client.owner.lastName}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No owner assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {FUTURE_MODULES.map((module) => (
          <Card key={module.key} size="sm">
            <CardContent>
              <EmptyState
                icon={module.icon}
                title={module.label}
                description="Coming in a future phase."
                className="py-4"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <EmptyState icon={Clock} title="No activity yet" description="Changes to this client will show up here." />
          ) : (
            <ul className="grid gap-3">
              {activity.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">
                      {event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : "Someone"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {ACTIVITY_LABEL[event.action] ?? "updated this client"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
