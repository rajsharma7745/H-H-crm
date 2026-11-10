import { requireAuth } from "@/lib/rbac/authorize";
import { visibleNavItems } from "@/lib/navigation";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Breadcrumbs } from "@/components/app-shell/breadcrumbs";
import { NotificationsButton } from "@/components/app-shell/notifications-button";
import { BrandMark } from "@/components/app-shell/brand-mark";
import { TimeZoneSync } from "@/components/timezone";
import { getViewerTimeZone } from "@/lib/timezone-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const timeZone = await getViewerTimeZone();
  const granted = new Set(user.role.permissions.map((rp) => rp.permission.key as PermissionKey));
  const items = visibleNavItems(granted);

  return (
    <div className="flex min-h-svh bg-background">
      {/*
        The shell is now layered: a white sidebar and header sitting on the
        tinted app canvas, so page content reads as cards on a surface rather
        than as text floating on a white page.
      */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <BrandMark />
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav items={items} />
        </div>

        <div className="shrink-0 border-t p-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/75 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {/* Menu first on mobile: it is the primary control on this row. */}
            <div className="md:hidden">
              <MobileNav items={items} user={user} />
            </div>
            <BrandMark className="md:hidden" showWordmark={false} />
            <div className="hidden min-w-0 md:block">
              <Breadcrumbs items={items} />
            </div>
            <div className="min-w-0 md:hidden">
              <Breadcrumbs items={items} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationsButton />
          </div>
        </header>

        <main className="flex-1">{children}</main>
        <TimeZoneSync serverTimeZone={timeZone} />
      </div>
    </div>
  );
}
