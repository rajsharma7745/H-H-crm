import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, Users2, Lock, ArrowRight, Info } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission, userHasPermission } from "@/lib/rbac/authorize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, PageSection, PageShell } from "@/components/page-shell";
import { LeadStageBadge } from "@/app/(app)/leads/lead-stage-badge";
import { STAGES_BY_PIPELINE } from "@/lib/validation";
import type { LeadStage } from "@prisma/client";

export const metadata: Metadata = { title: "Settings" };

/** The lead-related permissions worth showing per role, in a readable order. */
const PERMISSION_COLUMNS = [
  { key: "leads.view", label: "See leads" },
  { key: "leads.create", label: "Add leads" },
  { key: "leads.update", label: "Edit, move & assign" },
  { key: "leads.delete", label: "Delete leads" },
  { key: "reports.view", label: "Reports" },
  { key: "users.view", label: "Team" },
  { key: "settings.view", label: "Settings" },
] as const;

/** Marks a panel whose contents cannot be changed from this page. */
function ReadOnlyBadge() {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Lock className="size-3" aria-hidden="true" />
      Read-only
    </Badge>
  );
}

export default async function SettingsPage() {
  const currentUser = await requirePermission("settings.view");
  const canManageUsers = userHasPermission(currentUser, "users.view");

  const [roles, sourcesInUse, leadCount] = await Promise.all([
    // Read the live grants rather than the seed defaults, so this page shows
    // what the database actually enforces today.
    db.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    }),
    db.lead.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
    db.lead.count(),
  ]);

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Settings"
        description="How this workspace is set up. Everything on this page is information rather than a control — the “Not configurable yet” section at the bottom explains what that means and why."
        meta={
          <div className="pt-1">
            <ReadOnlyBadge />
          </div>
        }
      />

      <PageSection
        className="mt-8"
        title="Pipelines and stages"
        description="The two pipelines every lead belongs to, and the stages within each."
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Fixed pipeline stages
              <ReadOnlyBadge />
            </CardTitle>
            <CardDescription>
              Stages are built into the database and enforced by pipeline-aware validation, so a lead can never hold a
              stage belonging to the other pipeline. Changing them safely needs a migration, not a setting.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium">Ads</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Leads that arrive through advertising.</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {STAGES_BY_PIPELINE.ADS.map((stage) => (
                  <LeadStageBadge key={stage} stage={stage as LeadStage} />
                ))}
              </div>
              <Link
                href="/leads/ads"
                className="mt-3 inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline"
              >
                Open the Ads board
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
            <div>
              <p className="text-sm font-medium">Warm Approach</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Leads your team approaches directly.</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {STAGES_BY_PIPELINE.WARM_APPROACH.map((stage) => (
                  <LeadStageBadge key={stage} stage={stage as LeadStage} />
                ))}
              </div>
              <Link
                href="/leads/warm-approach"
                className="mt-3 inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline"
              >
                Open the Warm Approach board
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection
        className="mt-8"
        title="Roles and access"
        description="What each role is allowed to do. These are the live grants, read straight from the database."
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Permissions by role
              <ReadOnlyBadge />
            </CardTitle>
            <CardDescription>
              A tick means everyone with that role can do it. Roles themselves are managed by the seed and admin
              tooling, not from this page — but you can change which role a person has on the Team page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Role
                    </TableHead>
                    {PERMISSION_COLUMNS.map((column) => (
                      <TableHead
                        key={column.key}
                        className="min-w-24 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => {
                    const granted = new Set(role.permissions.map((rp) => rp.permission.key));
                    return (
                      <TableRow key={role.id}>
                        <TableCell className="text-sm font-medium">{role.name}</TableCell>
                        {PERMISSION_COLUMNS.map((column) => (
                          <TableCell key={column.key} className="text-center">
                            {/* Colour plus shape plus an accessible label — a
                                tick is never the only cue that access is granted. */}
                            {granted.has(column.key) ? (
                              <span className="mx-auto flex size-5 items-center justify-center rounded-full bg-success/10 text-success">
                                <Check className="size-3.5" aria-hidden="true" />
                                <span className="sr-only">Allowed</span>
                              </span>
                            ) : (
                              <span className="mx-auto flex size-5 items-center justify-center text-muted-foreground/40">
                                <Minus className="size-3.5" aria-hidden="true" />
                                <span className="sr-only">Not allowed</span>
                              </span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {canManageUsers && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                nativeButton={false}
                render={
                  <Link href="/admin/users">
                    <Users2 className="size-4" />
                    Manage team members
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      </PageSection>

      <PageSection
        className="mt-8"
        title="Data in use"
        description="Values your team has actually entered, useful for spotting inconsistencies."
      >
        <Card>
          <CardHeader>
            <CardTitle>Lead sources</CardTitle>
            <CardDescription>
              Source is free text on each lead, so this is every distinct value in the data today. Watch for typos and
              near-duplicates — they quietly split your reports in two.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leadCount === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No leads yet, so there are no sources to show.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Source
                    </TableHead>
                    <TableHead className="w-24 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Leads
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourcesInUse.map((row) => (
                    <TableRow key={row.source ?? "none"}>
                      <TableCell className="text-sm">
                        {row.source ?? <span className="text-muted-foreground">No source recorded</span>}
                      </TableCell>
                      <TableCell className="tabular-metric text-right text-sm font-medium">
                        {row._count._all}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageSection>

      <PageSection
        className="mt-8"
        title="Not configurable yet"
        description="Deliberately deferred rather than half-built. None of these is needed to run the system day to day."
      >
        <Card>
          <CardContent className="grid gap-4">
            {[
              {
                title: "A managed list of lead sources",
                body: "Sources are free text today. Turning them into a managed list means a new table, a migration and swapping the lead form's text box for a picker — worth doing once the list above shows which values actually matter.",
              },
              {
                title: "Default follow-up preferences",
                body: "Defaults for type, priority and lead time would need somewhere to store settings. The follow-up form already defaults to Call and Medium, which covers the common case.",
              },
              {
                title: "Editable pipeline stages",
                body: "Stages are a database enum that validation, both boards and every report depend on. Making them editable is a schema change, not a toggle, so it stays out until it is genuinely needed.",
              },
            ].map((item) => (
              <div key={item.title} className="border-l-2 border-border pl-3">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}

            <div className="border-l-2 border-border pl-3">
              <p className="text-sm font-medium">Email, WhatsApp and SMS notifications</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                No outbound provider is set up, so overdue work is surfaced inside the app instead — on the{" "}
                <Link href="/follow-ups?view=overdue" className="font-medium text-primary hover:underline">
                  Follow-ups
                </Link>{" "}
                page and on the dashboard.
              </p>
            </div>
          </CardContent>
        </Card>

        <aside className="flex gap-3 rounded-xl border bg-muted/40 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Need one of these? Tell an administrator — each is a deliberate decision that can be revisited, not a
            limitation of the system.
          </p>
        </aside>
      </PageSection>
    </PageShell>
  );
}
