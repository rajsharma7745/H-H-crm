/**
 * Central permission registry.
 *
 * This is the ONLY place permission keys are defined. Future phases add new
 * entries here (and to ROLE_PERMISSION_DEFAULTS below) and re-run the seed —
 * no changes to auth/session/middleware code are ever required to support a
 * new module's permissions.
 *
 * Key format: "<module>.<action>".
 */

export const PERMISSION_DEFINITIONS = [
  // Phase 1 — actively enforced
  { key: "users.view", module: "users", action: "view", description: "View user accounts" },
  { key: "users.create", module: "users", action: "create", description: "Create user accounts" },
  { key: "users.update", module: "users", action: "update", description: "Edit user accounts and roles" },
  { key: "users.delete", module: "users", action: "delete", description: "Deactivate/delete user accounts" },

  { key: "settings.view", module: "settings", action: "view", description: "View application settings" },
  { key: "settings.update", module: "settings", action: "update", description: "Change application settings" },

  // Reserved for later phases — establishing the architecture now so those
  // modules can ship without touching the permission system itself.
  { key: "clients.view", module: "clients", action: "view", description: "View clients" },
  { key: "clients.create", module: "clients", action: "create", description: "Create clients" },
  { key: "clients.update", module: "clients", action: "update", description: "Edit clients" },
  { key: "clients.delete", module: "clients", action: "delete", description: "Delete clients" },

  { key: "leads.view", module: "leads", action: "view", description: "View leads" },
  { key: "leads.create", module: "leads", action: "create", description: "Create leads" },
  { key: "leads.update", module: "leads", action: "update", description: "Edit leads" },
  { key: "leads.delete", module: "leads", action: "delete", description: "Delete leads" },

  { key: "tasks.view", module: "tasks", action: "view", description: "View tasks" },
  { key: "tasks.create", module: "tasks", action: "create", description: "Create tasks" },
  { key: "tasks.update", module: "tasks", action: "update", description: "Edit tasks" },
  { key: "tasks.delete", module: "tasks", action: "delete", description: "Delete tasks" },

  { key: "time.view", module: "time", action: "view", description: "View time entries" },
  { key: "time.create", module: "time", action: "create", description: "Log time entries" },
  { key: "time.update", module: "time", action: "update", description: "Edit time entries" },
  { key: "time.delete", module: "time", action: "delete", description: "Delete time entries" },

  { key: "files.view", module: "files", action: "view", description: "View files" },
  { key: "files.create", module: "files", action: "create", description: "Upload files" },
  { key: "files.update", module: "files", action: "update", description: "Edit file metadata" },
  { key: "files.delete", module: "files", action: "delete", description: "Delete files" },

  { key: "credentials.view", module: "credentials", action: "view", description: "View vault credentials" },
  { key: "credentials.create", module: "credentials", action: "create", description: "Add vault credentials" },
  { key: "credentials.update", module: "credentials", action: "update", description: "Edit vault credentials" },
  { key: "credentials.delete", module: "credentials", action: "delete", description: "Delete vault credentials" },

  { key: "reports.view", module: "reports", action: "view", description: "View reports" },
] as const;

export type PermissionKey = (typeof PERMISSION_DEFINITIONS)[number]["key"];

export const ROLE_DEFINITIONS = [
  { key: "SUPER_ADMIN", name: "Super Admin", description: "Full system access." },
  { key: "MANAGER", name: "Manager", description: "Manages team, clients and day-to-day operations." },
  { key: "EMPLOYEE", name: "Employee", description: "Works within assigned clients, projects and tasks." },
  { key: "INTERN", name: "Intern", description: "Most restricted operating role." },
] as const;

export type RoleKey = (typeof ROLE_DEFINITIONS)[number]["key"];

/**
 * Default role → permission grants, seeded on first setup and re-applied by
 * `npm run db:seed`. This mirrors the Section 3 permission matrix in the
 * master spec at Phase-1 granularity (view/create/update/delete) — refine
 * per-role scoping (e.g. "assigned only") is enforced by each module's own
 * queries in later phases, not by this coarse role→permission grant.
 *
 * Adjust freely: this is data, not code that other systems depend on.
 */
export const ROLE_PERMISSION_DEFAULTS: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_DEFINITIONS.map((p) => p.key) as PermissionKey[],

  MANAGER: [
    "users.view",
    "users.update",
    "settings.view",
    "clients.view",
    "clients.create",
    "clients.update",
    "leads.view",
    "leads.create",
    "leads.update",
    "leads.delete",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",
    "time.view",
    "time.create",
    "time.update",
    "files.view",
    "files.create",
    "files.update",
    "credentials.view",
    "reports.view",
  ],

  EMPLOYEE: [
    "clients.view",
    "leads.view",
    "leads.update",
    "tasks.view",
    "tasks.update",
    "time.view",
    "time.create",
    "time.update",
    "files.view",
    "files.create",
    "reports.view",
  ],

  INTERN: [
    "clients.view",
    "leads.view",
    "tasks.view",
    "tasks.update",
    "time.view",
    "time.create",
    "time.update",
    "files.view",
  ],
};
