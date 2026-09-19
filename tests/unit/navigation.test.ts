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
    const item = NAV_ITEMS.find((i) => i.key === "clients")!;
    expect(isNavItemVisible(item, new Set())).toBe(false);
    expect(isNavItemVisible(item, new Set(["clients.view"]))).toBe(true);
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

  it("hides Users and Employees from roles without users.view", () => {
    const items = visibleNavItems(grantedFor("EMPLOYEE"));
    expect(items.some((i) => i.key === "users")).toBe(false);
    expect(items.some((i) => i.key === "employees")).toBe(false);
  });

  it("shows Users and Employees to MANAGER (has users.view)", () => {
    const items = visibleNavItems(grantedFor("MANAGER"));
    expect(items.some((i) => i.key === "users")).toBe(true);
    expect(items.some((i) => i.key === "employees")).toBe(true);
  });

  it("every 'soon' item is inert: it never carries an href", () => {
    for (const item of NAV_ITEMS) {
      if (item.status === "soon") {
        expect((item as { href?: string }).href).toBeUndefined();
      }
    }
  });
});

describe("buildBreadcrumbs", () => {
  const items = visibleNavItems(grantedFor("SUPER_ADMIN"));

  it("matches the exact href of an active nav item", () => {
    expect(buildBreadcrumbs("/dashboard", items)).toEqual([{ label: "Dashboard", href: "/dashboard" }]);
    expect(buildBreadcrumbs("/admin/users", items)).toEqual([{ label: "Users", href: "/admin/users" }]);
  });

  it("matches nested paths under an active item's href", () => {
    expect(buildBreadcrumbs("/admin/users/123", items)).toEqual([{ label: "Users", href: "/admin/users" }]);
  });

  it("matches the Clients detail route to the Clients crumb", () => {
    expect(buildBreadcrumbs("/clients", items)).toEqual([{ label: "Clients", href: "/clients" }]);
    expect(buildBreadcrumbs("/clients/abc123", items)).toEqual([{ label: "Clients", href: "/clients" }]);
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
    const leadsLikePath = "/leads";
    const result = buildBreadcrumbs(leadsLikePath, items);
    expect(result).not.toEqual([{ label: "Leads" }]);
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
