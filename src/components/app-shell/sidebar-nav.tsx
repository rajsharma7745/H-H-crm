"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Handshake,
  ListChecks,
  BellRing,
  Users2,
  BarChart3,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { groupedNavItems, type NavIconKey, type NavItemDef } from "@/lib/navigation";

const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  "ads-pipeline": Megaphone,
  "warm-approach-pipeline": Handshake,
  "all-leads": ListChecks,
  "follow-ups": BellRing,
  team: Users2,
  reports: BarChart3,
  settings: SettingsIcon,
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Two things changed here and both are about recognisability:
 *
 *  - Items are grouped under section headings, so the difference between
 *    everyday lead work and occasional administration is visible.
 *  - The active item now uses the brand colour plus a left accent bar and
 *    `aria-current="page"`, instead of a grey wash that was easy to miss and
 *    invisible to a screen reader.
 *
 * `/leads` would otherwise light up for `/leads/ads` too, since the pipeline
 * routes are nested under it — the longest matching href wins instead.
 */
export function SidebarNav({ items, onNavigate }: { items: NavItemDef[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = groupedNavItems(items);

  const activeHref = items
    .filter((item): item is Extract<NavItemDef, { status: "active" }> => item.status === "active")
    .filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-1">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>

          {group.items.map((item) => {
            const Icon = ICONS[item.icon];
            const label = item.shortLabel ?? item.label;

            if (item.status === "soon") {
              return (
                <div
                  key={item.key}
                  aria-disabled="true"
                  title={`${item.label} — coming soon`}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/60"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{label}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-muted-foreground/70">
                    Soon
                  </Badge>
                </div>
              );
            }

            const active = item.href === activeHref;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={item.hint}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                  />
                )}
                <Icon
                  className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground/80")}
                  aria-hidden="true"
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
