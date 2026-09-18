import type { Metadata } from "next";
import { requireAuth } from "@/lib/rbac/authorize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireAuth();
  const permissionCount = user.role.permissions.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.firstName}.</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Phase 1 — Application Foundation, Authentication & Permissions is live.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Your account</CardTitle>
          <CardDescription>
            This is a foundation dashboard. Clients, leads, tasks, time tracking and reporting
            ship in later phases and will appear here as they&apos;re built.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Role</p>
            <Badge variant="secondary" className="mt-1">
              {user.role.name}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Permissions granted</p>
            <p className="mt-1 font-medium">{permissionCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Account status</p>
            <p className="mt-1 font-medium">{user.status === "ACTIVE" ? "Active" : "Inactive"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last login</p>
            <p className="mt-1 font-medium">
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "This is your first login"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
