import { requireAuth, userHasPermission } from "@/lib/rbac/authorize";
import { SidebarNav, type NavItem } from "@/components/app-shell/sidebar-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { MobileNav } from "@/components/app-shell/mobile-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  const items: NavItem[] = [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }];
  if (userHasPermission(user, "users.view")) {
    items.push({ href: "/admin/users", label: "Users", icon: "users" });
  }

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-neutral-50/60 dark:bg-neutral-900/40 md:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-950 text-xs font-bold text-white">
            H&H
          </div>
          <span className="text-sm font-semibold tracking-tight">H&H CRM</span>
        </div>

        <div className="flex-1 py-2">
          <SidebarNav items={items} />
        </div>

        <div className="border-t p-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-950 text-xs font-bold text-white">
              H&H
            </div>
            <span className="text-sm font-semibold tracking-tight">H&H CRM</span>
          </div>
          <MobileNav items={items} user={user} />
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
