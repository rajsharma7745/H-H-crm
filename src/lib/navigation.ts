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
  | "ads-pipeline"
  | "warm-approach-pipeline"
  | "all-leads"
  | "follow-ups"
  | "team"
  | "reports"
  | "settings";

/**
 * Sidebar sections. Eight flat, equally-weighted links gave no clue which
 * ones are daily work and which are occasional administration; grouping them
 * under headings does, and costs nothing at runtime.
 */
export type NavGroupKey = "overview" | "work" | "manage";

export const NAV_GROUPS: readonly { key: NavGroupKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "work", label: "Lead management" },
  { key: "manage", label: "Administration" },
] as const;

type NavItemBase = {
  key: string;
  /** Canonical name — used by breadcrumbs and page titles. */
  label: string;
  /** Sidebar name, when the canonical one is too long for a 16rem column. */
  shortLabel?: string;
  /** Short plain-English explanation, shown in the mobile nav and on hover. */
  hint: string;
  icon: NavIconKey;
  group: NavGroupKey;
  permission?: PermissionKey;
};

export type NavItemDef =
  | (NavItemBase & { status: "active"; href: string })
  | (NavItemBase & { status: "soon" });

// Lead Management System navigation (H&H CRM scope change, Phase 0). Clients
// is deliberately absent here — the module and its data stay intact, it's
// just no longer part of the primary nav (see EXTRA_BREADCRUMBS below for
// how a direct visit to /clients still gets a correct breadcrumb).
export const NAV_ITEMS: readonly NavItemDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    hint: "Today's numbers and what needs attention",
    icon: "dashboard",
    group: "overview",
    status: "active",
    href: "/dashboard",
  },
  {
    key: "ads-pipeline",
    label: "Ads Pipeline",
    hint: "Leads from ad campaigns: Cold → Warm → Hot",
    icon: "ads-pipeline",
    group: "work",
    status: "active",
    href: "/leads/ads",
    permission: "leads.view",
  },
  {
    key: "warm-approach-pipeline",
    label: "Warm Approach Pipeline",
    shortLabel: "Warm Approach",
    hint: "Direct outreach: Plan Meet → Pitched → Proposal Sent",
    icon: "warm-approach-pipeline",
    group: "work",
    status: "active",
    href: "/leads/warm-approach",
    permission: "leads.view",
  },
  {
    key: "all-leads",
    label: "All Leads",
    hint: "Every lead from both pipelines, in one searchable list",
    icon: "all-leads",
    group: "work",
    status: "active",
    href: "/leads",
    permission: "leads.view",
  },
  {
    key: "follow-ups",
    label: "Follow-ups",
    hint: "Your daily queue of calls, emails and meetings",
    icon: "follow-ups",
    group: "work",
    status: "active",
    href: "/follow-ups",
    permission: "leads.view",
  },
  {
    key: "team",
    label: "Team",
    hint: "People with access and what they are allowed to do",
    icon: "team",
    group: "manage",
    status: "active",
    href: "/admin/users",
    permission: "users.view",
  },
  {
    key: "reports",
    label: "Reports",
    hint: "Conversion, sources and team performance over time",
    icon: "reports",
    group: "manage",
    status: "active",
    href: "/reports",
    permission: "reports.view",
  },
  {
    key: "settings",
    label: "Settings",
    hint: "How this workspace is configured",
    icon: "settings",
    group: "manage",
    status: "active",
    href: "/settings",
    permission: "settings.view",
  },
] as const;

export function isNavItemVisible(item: NavItemDef, granted: ReadonlySet<PermissionKey>): boolean {
  return !item.permission || granted.has(item.permission);
}

/** Filters NAV_ITEMS down to what a user (identified by their granted permission keys) should see. */
export function visibleNavItems(granted: ReadonlySet<PermissionKey>): NavItemDef[] {
  return NAV_ITEMS.filter((item) => isNavItemVisible(item, granted));
}

/**
 * Splits visible nav items into their sidebar sections, dropping any section
 * a user's permissions have emptied out entirely.
 */
export function groupedNavItems(
  items: readonly NavItemDef[],
): { key: NavGroupKey; label: string; items: NavItemDef[] }[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.key),
  })).filter((group) => group.items.length > 0);
}

export type BreadcrumbEntry = { label: string; href?: string };

// Pages reachable from the app shell that aren't in the sidebar itself
// (e.g. the profile page, opened from the user menu, not the nav; or
// Clients, whose module stays intact but is hidden from primary nav).
const EXTRA_BREADCRUMBS: readonly { href: string; label: string }[] = [
  { href: "/profile", label: "Profile" },
  { href: "/clients", label: "Clients" },
];

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
