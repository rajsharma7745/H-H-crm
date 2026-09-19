"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildBreadcrumbs, type NavItemDef } from "@/lib/navigation";

export function Breadcrumbs({ items }: { items: NavItemDef[] }) {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname, items);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.href ?? crumb.label} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="truncate text-muted-foreground hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn("truncate", isLast ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
