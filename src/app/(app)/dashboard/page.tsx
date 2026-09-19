import type { Metadata } from "next";
import Link from "next/link";
import { ListTodo, Building2, Clock, BellRing, Inbox, UserRound, Users2 } from "lucide-react";
import { requireAuth, userHasPermission } from "@/lib/rbac/authorize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { GreetingHeading } from "@/components/app-shell/greeting-heading";

export const metadata: Metadata = { title: "Dashboard" };

const OVERVIEW_CARDS = [
  { key: "tasks", label: "My Tasks", icon: ListTodo, note: "Live once Tasks ships" },
  { key: "clients", label: "Active Clients", icon: Building2, note: "Live once Clients ships" },
  { key: "time", label: "Time Today", icon: Clock, note: "Live once Time Tracker ships" },
  { key: "pending", label: "Pending Items", icon: BellRing, note: "Live once Leads ships" },
] as const;

export default async function DashboardPage() {
  const user = await requireAuth();
  const permissionCount = user.role.permissions.length;
  const canViewUsers = userHasPermission(user, "users.view");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <div>
        <GreetingHeading firstName={user.firstName} />
        <p className="mt-1.5 text-sm text-muted-foreground">Here&apos;s what&apos;s happening across H&amp;H CRM.</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OVERVIEW_CARDS.map((card) => (
          <Card key={card.key}>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight text-muted-foreground/40">—</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>What&apos;s happened recently across your work.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Inbox}
              title="No activity yet"
              description="Activity from clients, leads, tasks and time entries will show up here once those modules are live."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Things you can do right now.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="justify-start"
              nativeButton={false}
              render={
                <Link href="/profile">
                  <UserRound className="size-4" />
                  Edit your profile
                </Link>
              }
            />
            {canViewUsers && (
              <Button
                variant="outline"
                className="justify-start"
                nativeButton={false}
                render={
                  <Link href="/admin/users">
                    <Users2 className="size-4" />
                    Manage users
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Your account</CardTitle>
          <CardDescription>
            This is a foundation dashboard. Clients, leads, tasks, time tracking and reporting ship in later phases
            and will appear here as they&apos;re built.
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
