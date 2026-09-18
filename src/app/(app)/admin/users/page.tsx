import type { Metadata } from "next";
import { Suspense } from "react";
import { UserPlus } from "lucide-react";
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
import { UserFilters } from "@/app/(app)/admin/users/user-filters";
import { UserDialog } from "@/app/(app)/admin/users/user-dialog";
import { UserRowActions } from "@/app/(app)/admin/users/user-row-actions";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const currentUser = await requirePermission("users.view");
  const { q, role, status } = await searchParams;

  const canCreate = userHasPermission(currentUser, "users.create");
  const canUpdate = userHasPermission(currentUser, "users.update");
  const canDeactivate = userHasPermission(currentUser, "users.delete");
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

  const [users, roles] = await Promise.all([
    db.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
    db.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Non-Super-Admins can't grant Super Admin access (also enforced server-side
  // in updateUserAction) — keep it out of the picker entirely.
  const assignableRoles = isSuperAdmin ? roles : roles.filter((r) => r.key !== "SUPER_ADMIN");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage who has access to H&H CRM and what they can do.
          </p>
        </div>
        {canCreate && (
          <UserDialog
            roles={assignableRoles}
            trigger={
              <Button>
                <UserPlus className="size-4" />
                Create user
              </Button>
            }
          />
        )}
      </div>

      <div className="mt-6">
        <Suspense fallback={null}>
          <UserFilters roles={roles} />
        </Suspense>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  No users match your filters.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => {
              const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user.firstName} {user.lastName}
                          {user.id === currentUser.id && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.role.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === "ACTIVE" ? "default" : "outline"}>
                      {user.status === "ACTIVE" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <UserRowActions
                      user={user}
                      roles={assignableRoles}
                      canUpdate={
                        canUpdate && (isSuperAdmin || user.role.key !== "SUPER_ADMIN")
                      }
                      canDeactivate={
                        canDeactivate && (isSuperAdmin || user.role.key !== "SUPER_ADMIN")
                      }
                      isSelf={user.id === currentUser.id}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
