"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Target,
  ListChecks,
  CalendarDays,
  Clock,
  UsersRound,
  BarChart3,
  Users2,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { NavIconKey, NavItemDef } from "@/lib/navigation";

const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  clients: Building2,
  leads: Target,
  tasks: ListChecks,
  calendar: CalendarDays,
  time: Clock,
  employees: UsersRound,
  reports: BarChart3,
  users: Users2,
  settings: SettingsIcon,
};

export function SidebarNav({ items, onNavigate }: { items: NavItemDef[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1 px-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon];

        if (item.status === "soon") {
          return (
            <div
              key={item.key}
              aria-disabled="true"
              title={`${item.label} — coming soon`}
              className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60"
            >
              <Icon className="size-4" />
              <span className="flex-1 truncate">{item.label}</span>
              <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-muted-foreground/70">
                Soon
              </Badge>
            </div>
          );
        }

        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-neutral-100 text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50"
                : "text-muted-foreground hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
