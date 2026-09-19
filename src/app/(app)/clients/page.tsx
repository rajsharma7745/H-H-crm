import type { Metadata } from "next";
import { Suspense } from "react";
import { Building2, Plus, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission, userHasPermission } from "@/lib/rbac/authorize";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ClientFilters } from "@/app/(app)/clients/client-filters";
import { ClientDialog } from "@/app/(app)/clients/client-dialog";
import { ClientList } from "@/app/(app)/clients/client-list";
import { buildClientWhere, parseClientStatusFilter } from "@/lib/queries/clients";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; owner?: string }>;
}) {
  const currentUser = await requirePermission("clients.view");
  const { q, status, owner } = await searchParams;

  const canCreate = userHasPermission(currentUser, "clients.create");
  const canUpdate = userHasPermission(currentUser, "clients.update");
  const canDeactivate = userHasPermission(currentUser, "clients.delete");

  const statusFilter = parseClientStatusFilter(status);
  const hasFilters = Boolean(q || statusFilter || owner);
  const where = buildClientWhere({ q, status, owner });

  const [clients, owners, totalClientCount] = await Promise.all([
    db.client.findMany({
      where,
      include: { owner: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.client.count(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The agency&apos;s clients, in one place — searchable, filterable and always up to date.
          </p>
        </div>
        {canCreate && (
          <ClientDialog
            owners={owners}
            trigger={
              <Button>
                <Plus className="size-4" />
                Add client
              </Button>
            }
          />
        )}
      </div>

      <div className="mt-6">
        <Suspense fallback={null}>
          <ClientFilters owners={owners} />
        </Suspense>
      </div>

      <div className="mt-4">
        {clients.length === 0 && totalClientCount === 0 && (
          <div className="rounded-lg border">
            <EmptyState
              icon={Building2}
              title="No clients yet"
              description="Add your first client to start building out the client list."
              action={
                canCreate && (
                  <ClientDialog
                    owners={owners}
                    trigger={
                      <Button size="sm" className="mt-1">
                        <Plus className="size-4" />
                        Add client
                      </Button>
                    }
                  />
                )
              }
            />
          </div>
        )}

        {clients.length === 0 && totalClientCount > 0 && (
          <div className="rounded-lg border">
            <EmptyState
              icon={SearchX}
              title="No clients match your filters"
              description={hasFilters ? "Try a different search term or clear the filters." : undefined}
            />
          </div>
        )}

        {clients.length > 0 && (
          <ClientList clients={clients} owners={owners} canUpdate={canUpdate} canDeactivate={canDeactivate} />
        )}
      </div>
    </div>
  );
}
