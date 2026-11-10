import { describe, expect, it } from "vitest";
import {
  NAV_ITEMS,
  buildBreadcrumbs,
  isNavItemVisible,
  visibleNavItems,
  type NavItemDef,
} from "@/lib/navigation";
import { ROLE_PERMISSION_DEFAULTS, type PermissionKey, type RoleKey } from "@/lib/rbac/permissions";

function grantedFor(role: RoleKey): Set<PermissionKey> {
  return new Set(ROLE_PERMISSION_DEFAULTS[role]);
}

describe("isNavItemVisible", () => {
  it("is always visible when the item has no permission requirement", () => {
    const item = NAV_ITEMS.find((i) => i.key === "dashboard")!;
    expect(isNavItemVisible(item, new Set())).toBe(true);
  });

  it("requires the granted set to contain the item's permission", () => {
    const item = NAV_ITEMS.find((i) => i.key === "reports")!;
    expect(isNavItemVisible(item, new Set())).toBe(false);
    expect(isNavItemVisible(item, new Set(["reports.view"]))).toBe(true);
  });
});

describe("visibleNavItems", () => {
  it("always includes Dashboard, regardless of role", () => {
    for (const role of ["SUPER_ADMIN", "MANAGER", "EMPLOYEE", "INTERN"] as RoleKey[]) {
      const items = visibleNavItems(grantedFor(role));
      expect(items.some((i) => i.key === "dashboard")).toBe(true);
    }
  });

  it("SUPER_ADMIN sees every nav item", () => {
    const items = visibleNavItems(grantedFor("SUPER_ADMIN"));
    expect(items).toHaveLength(NAV_ITEMS.length);
  });

  it("hides Settings from EMPLOYEE and INTERN (neither has settings.view)", () => {
    for (const role of ["EMPLOYEE", "INTERN"] as RoleKey[]) {
      const items = visibleNavItems(grantedFor(role));
      expect(items.some((i) => i.key === "settings")).toBe(false);
    }
  });

  it("hides Team from roles without users.view", () => {
    const items = visibleNavItems(grantedFor("EMPLOYEE"));
    expect(items.some((i) => i.key === "team")).toBe(false);
  });

  it("shows Team to MANAGER (has users.view)", () => {
    const items = visibleNavItems(grantedFor("MANAGER"));
    expect(items.some((i) => i.key === "team")).toBe(true);
  });

  it("hides Clients from every role — the module is intentionally out of primary nav", () => {
    for (const role of ["SUPER_ADMIN", "MANAGER", "EMPLOYEE", "INTERN"] as RoleKey[]) {
      const items = visibleNavItems(grantedFor(role));
      expect(items.some((i) => i.key === "clients")).toBe(false);
    }
  });

  it("shows the Ads and Warm Approach pipeline nav items to every role (all have leads.view)", () => {
    for (const role of ["SUPER_ADMIN", "MANAGER", "EMPLOYEE", "INTERN"] as RoleKey[]) {
      const items = visibleNavItems(grantedFor(role));
      expect(items.some((i) => i.key === "ads-pipeline")).toBe(true);
      expect(items.some((i) => i.key === "warm-approach-pipeline")).toBe(true);
    }
  });

  it("every 'soon' item is inert: it never carries an href", () => {
    for (const item of NAV_ITEMS) {
      if (item.status === "soon") {
        expect((item as { href?: string }).href).toBeUndefined();
      }
    }
  });

  it("every nav item now points at a real route — no 'coming soon' placeholders left", () => {
    expect(NAV_ITEMS.filter((item) => item.status === "soon")).toEqual([]);
    for (const item of NAV_ITEMS) {
      expect((item as { href?: string }).href).toMatch(/^\//);
    }
  });
});

describe("buildBreadcrumbs", () => {
  const items = visibleNavItems(grantedFor("SUPER_ADMIN"));

  it("matches the exact href of an active nav item", () => {
    expect(buildBreadcrumbs("/dashboard", items)).toEqual([{ label: "Dashboard", href: "/dashboard" }]);
    expect(buildBreadcrumbs("/admin/users", items)).toEqual([{ label: "Team", href: "/admin/users" }]);
  });

  it("matches nested paths under an active item's href", () => {
    expect(buildBreadcrumbs("/admin/users/123", items)).toEqual([{ label: "Team", href: "/admin/users" }]);
  });

  it("falls back to the extra-page map for Clients, which is intact but hidden from nav", () => {
    expect(buildBreadcrumbs("/clients", items)).toEqual([{ label: "Clients" }]);
    expect(buildBreadcrumbs("/clients/abc123", items)).toEqual([{ label: "Clients" }]);
  });

  it("falls back to the extra-page map for pages outside the nav (e.g. profile)", () => {
    expect(buildBreadcrumbs("/profile", items)).toEqual([{ label: "Profile" }]);
  });

  it("matches nested paths under an extra-page entry, not just the exact path", () => {
    expect(buildBreadcrumbs("/profile/security", items)).toEqual([{ label: "Profile" }]);
  });

  it("falls back to Dashboard for an unrecognized path", () => {
    expect(buildBreadcrumbs("/something-unknown", items)).toEqual([{ label: "Dashboard", href: "/dashboard" }]);
  });

  it("never matches a 'soon' item, since it has no href to match against", () => {
    // Uses a synthetic item rather than a real nav entry: every shipped item
    // is now "active", and this rule still has to hold for future ones.
    const soonItems: NavItemDef[] = [
      {
        key: "future",
        label: "Future Module",
        hint: "A module that has not shipped yet",
        icon: "reports",
        group: "manage",
        status: "soon",
        permission: "reports.view",
      },
    ];
    expect(buildBreadcrumbs("/future", soonItems)).toEqual([{ label: "Dashboard", href: "/dashboard" }]);
  });

  it("matches the remaining top-level routes to their own crumbs", () => {
    expect(buildBreadcrumbs("/follow-ups", items)).toEqual([{ label: "Follow-ups", href: "/follow-ups" }]);
    expect(buildBreadcrumbs("/reports", items)).toEqual([{ label: "Reports", href: "/reports" }]);
    expect(buildBreadcrumbs("/settings", items)).toEqual([{ label: "Settings", href: "/settings" }]);
  });

  it("matches the All Leads detail route to the All Leads crumb, now that /leads is a real page", () => {
    expect(buildBreadcrumbs("/leads", items)).toEqual([{ label: "All Leads", href: "/leads" }]);
    expect(buildBreadcrumbs("/leads/abc123", items)).toEqual([{ label: "All Leads", href: "/leads" }]);
  });

  it("prefers the longer, more specific pipeline href over the shorter /leads href", () => {
    expect(buildBreadcrumbs("/leads/ads", items)).toEqual([{ label: "Ads Pipeline", href: "/leads/ads" }]);
    expect(buildBreadcrumbs("/leads/warm-approach", items)).toEqual([
      { label: "Warm Approach Pipeline", href: "/leads/warm-approach" },
    ]);
  });
});

describe("NAV_ITEMS data integrity", () => {
  it("has unique keys", () => {
    const keys = NAV_ITEMS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every active item's href is unique", () => {
    const hrefs = (NAV_ITEMS as NavItemDef[])
      .filter((i): i is Extract<NavItemDef, { status: "active" }> => i.status === "active")
      .map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
