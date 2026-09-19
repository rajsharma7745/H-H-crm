import { requireAuth } from "@/lib/rbac/authorize";
import { visibleNavItems } from "@/lib/navigation";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Breadcrumbs } from "@/components/app-shell/breadcrumbs";
import { NotificationsButton } from "@/components/app-shell/notifications-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const granted = new Set(user.role.permissions.map((rp) => rp.permission.key as PermissionKey));
  const items = visibleNavItems(granted);

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-neutral-50/60 dark:bg-neutral-900/40 md:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-950 text-xs font-bold text-white">
            H&H
          </div>
          <span className="text-sm font-semibold tracking-tight">H&H CRM</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav items={items} />
        </div>

        <div className="border-t p-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-xs font-bold text-white md:hidden">
              H&H
            </div>
            <span className="truncate text-sm font-semibold tracking-tight md:hidden">H&H CRM</span>
            <div className="hidden min-w-0 md:block">
              <Breadcrumbs items={items} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationsButton />
            <div className="md:hidden">
              <MobileNav items={items} user={user} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
