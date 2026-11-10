import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UserPlus, SearchX, ShieldCheck, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission, userHasPermission } from "@/lib/rbac/authorize";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyPanel } from "@/components/empty-state";
import { ActiveFilters, type ActiveFilter } from "@/components/active-filters";
import { FilterBar, PageHeader, PageShell, ResultCount } from "@/components/page-shell";
import { UserFilters } from "@/app/(app)/admin/users/user-filters";
import { UserDialog } from "@/app/(app)/admin/users/user-dialog";
import { UserRowActions } from "@/app/(app)/admin/users/user-row-actions";
import { formatDate, formatRelative, initialsOf } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Team" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const currentUser = await requirePermission("users.view");
  const { q, role, status } = await searchParams;
  const now = new Date();

  const canCreate = userHasPermission(currentUser, "users.create");
  const canUpdate = userHasPermission(currentUser, "users.update");
  const canDeactivate = userHasPermission(currentUser, "users.delete");
  const canViewSettings = userHasPermission(currentUser, "settings.view");
  const isSuperAdmin = currentUser.role.key === "SUPER_ADMIN";

  const where: Prisma.UserWhereInput = {
    ...(role ? { roleId: role } : {}),
    ...(status === "ACTIVE" || status === "INACTIVE" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, roles, totalUserCount] = await Promise.all([
    db.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.user.count(),
  ]);

  // Non-Super-Admins can't grant Super Admin access (also enforced server-side
  // in updateUserAction) — keep it out of the picker entirely.
  const assignableRoles = isSuperAdmin ? roles : roles.filter((r) => r.key !== "SUPER_ADMIN");

  const chips: ActiveFilter[] = [];
  if (q) chips.push({ key: "q", label: "Search", display: q });
  if (role) {
    const match = roles.find((r) => r.id === role);
    chips.push({ key: "role", label: "Role", display: match?.name ?? "Selected role" });
  }
  if (status === "ACTIVE" || status === "INACTIVE") {
    chips.push({
      key: "status",
      label: "Access",
      display: status === "ACTIVE" ? "Can sign in" : "Access revoked",
    });
  }

  const createButton = (
    <UserDialog
      roles={assignableRoles}
      trigger={
        <Button>
          <UserPlus className="size-4" />
          Add person
        </Button>
      }
    />
  );

  return (
    <PageShell>
      <PageHeader
        title="Team"
        description="Everyone who can sign in to H&H CRM. A person's role decides what they are allowed to see and change."
        actions={
          <>
            {canViewSettings && (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href="/settings">
                    <ShieldCheck className="size-4" />
                    What each role can do
                  </Link>
                }
              />
            )}
            {canCreate && createButton}
          </>
        }
      />

      {totalUserCount > 0 && (
        <FilterBar className="mt-6">
          <Suspense fallback={null}>
            <UserFilters roles={roles} />
          </Suspense>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Suspense fallback={null}>
              <ActiveFilters filters={chips} alsoClear={["q", "role", "status"]} />
            </Suspense>
            <ResultCount shown={users.length} total={totalUserCount} noun="person" pluralNoun="people" />
          </div>
        </FilterBar>
      )}

      {users.length === 0 ? (
        <EmptyPanel
          className="mt-4"
          icon={SearchX}
          title="Nobody matches your filters"
          description="No team member matches everything you are filtering by. Remove a filter above to see more people."
        />
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="py-2.5 pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Person
                  </TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Access
                  </TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Last signed in
                  </TableHead>
                  <TableHead className="w-12 py-2.5 pr-3">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="py-3 pl-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {initialsOf(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {user.firstName} {user.lastName}
                            {user.id === currentUser.id && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="secondary">{user.role.name}</Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant={user.status === "ACTIVE" ? "success" : "outline"}>
                        {user.status === "ACTIVE" ? "Can sign in" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {user.lastLoginAt ? (
                        <span title={formatDate(user.lastLoginAt)}>{formatRelative(user.lastLoginAt, now)}</span>
                      ) : (
                        "Never"
                      )}
                    </TableCell>
                    <TableCell className="py-3 pr-3">
                      <UserRowActions
                        user={user}
                        roles={assignableRoles}
                        canUpdate={canUpdate && (isSuperAdmin || user.role.key !== "SUPER_ADMIN")}
                        canDeactivate={canDeactivate && (isSuperAdmin || user.role.key !== "SUPER_ADMIN")}
                        isSelf={user.id === currentUser.id}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked cards, so nothing needs horizontal scrolling */}
          <div className="mt-4 grid gap-3 md:hidden">
            {users.map((user) => (
              <Card key={user.id} size="sm">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="text-xs">
                          {initialsOf(user.firstName, user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user.firstName} {user.lastName}
                          {user.id === currentUser.id && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <UserRowActions
                      user={user}
                      roles={assignableRoles}
                      canUpdate={canUpdate && (isSuperAdmin || user.role.key !== "SUPER_ADMIN")}
                      canDeactivate={canDeactivate && (isSuperAdmin || user.role.key !== "SUPER_ADMIN")}
                      isSelf={user.id === currentUser.id}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{user.role.name}</Badge>
                    <Badge variant={user.status === "ACTIVE" ? "success" : "outline"}>
                      {user.status === "ACTIVE" ? "Can sign in" : "Revoked"}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Last signed in {user.lastLoginAt ? formatRelative(user.lastLoginAt, now) : "never"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {canViewSettings && (
        <Link
          href="/settings"
          className="mt-6 inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline"
        >
          See the full permission matrix in Settings
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      )}
    </PageShell>
  );
}
