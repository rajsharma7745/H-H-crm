import type { PermissionKey } from "@/lib/rbac/permissions";

/**
 * Main app navigation — data only, no React/DOM here, so it can be unit
 * tested and reused by both the sidebar and the breadcrumb trail without
 * pulling in client-only code.
 *
 * "soon" items are modules the master spec defines but that haven't shipped
 * yet (see AGENTS.md phase plan). They render as inert/disabled — never as a
 * dead link — and are still permission-gated so nav doesn't advertise a
 * future module to a role that won't have access to it anyway.
 */

export type NavIconKey =
  | "dashboard"
  | "clients"
  | "leads"
  | "tasks"
  | "calendar"
  | "time"
  | "employees"
  | "reports"
  | "users"
  | "settings";

export type NavItemDef =
  | { key: string; label: string; icon: NavIconKey; status: "active"; href: string; permission?: PermissionKey }
  | { key: string; label: string; icon: NavIconKey; status: "soon"; permission?: PermissionKey };

export const NAV_ITEMS: readonly NavItemDef[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", status: "active", href: "/dashboard" },
  { key: "clients", label: "Clients", icon: "clients", status: "active", href: "/clients", permission: "clients.view" },
  { key: "leads", label: "Leads", icon: "leads", status: "soon", permission: "leads.view" },
  { key: "tasks", label: "Tasks", icon: "tasks", status: "soon", permission: "tasks.view" },
  {
    key: "content-calendar",
    label: "Content Calendar",
    icon: "calendar",
    status: "soon",
    permission: "tasks.view",
  },
  { key: "time-tracker", label: "Time Tracker", icon: "time", status: "soon", permission: "time.view" },
  { key: "employees", label: "Employees", icon: "employees", status: "soon", permission: "users.view" },
  { key: "reports", label: "Reports", icon: "reports", status: "soon", permission: "reports.view" },
  { key: "users", label: "Users", icon: "users", status: "active", href: "/admin/users", permission: "users.view" },
  { key: "settings", label: "Settings", icon: "settings", status: "soon", permission: "settings.view" },
] as const;

export function isNavItemVisible(item: NavItemDef, granted: ReadonlySet<PermissionKey>): boolean {
  return !item.permission || granted.has(item.permission);
}

/** Filters NAV_ITEMS down to what a user (identified by their granted permission keys) should see. */
export function visibleNavItems(granted: ReadonlySet<PermissionKey>): NavItemDef[] {
  return NAV_ITEMS.filter((item) => isNavItemVisible(item, granted));
}

export type BreadcrumbEntry = { label: string; href?: string };

// Pages reachable from the app shell that aren't in the sidebar itself
// (e.g. the profile page, opened from the user menu, not the nav).
const EXTRA_BREADCRUMBS: readonly { href: string; label: string }[] = [{ href: "/profile", label: "Profile" }];

function matchesPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Builds the breadcrumb trail for a given pathname against a user's visible nav items. */
export function buildBreadcrumbs(pathname: string, items: readonly NavItemDef[]): BreadcrumbEntry[] {
  const activeMatches = items.filter(
    (item): item is Extract<NavItemDef, { status: "active" }> =>
      item.status === "active" && matchesPath(pathname, item.href),
  );

  const bestNavMatch = activeMatches.sort((a, b) => b.href.length - a.href.length)[0];
  if (bestNavMatch) {
    return [{ label: bestNavMatch.label, href: bestNavMatch.href }];
  }

  // Same prefix-matching semantics as nav items, so a future sub-route
  // (e.g. /profile/security) still resolves to its parent's crumb instead
  // of falling through to the generic Dashboard fallback below.
  const bestExtraMatch = EXTRA_BREADCRUMBS.filter((entry) => matchesPath(pathname, entry.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  if (bestExtraMatch) {
    return [{ label: bestExtraMatch.label }];
  }

  return [{ label: "Dashboard", href: "/dashboard" }];
}
