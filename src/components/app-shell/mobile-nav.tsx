"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { SidebarNav, type NavItem } from "@/components/app-shell/sidebar-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import type { ComponentProps } from "react";

export function MobileNav({
  items,
  user,
}: {
  items: NavItem[];
  user: ComponentProps<typeof UserMenu>["user"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="h-16 justify-center border-b px-5">
          <SheetTitle className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-950 text-xs font-bold text-white">
              H&H
            </div>
            H&H CRM
          </SheetTitle>
        </SheetHeader>
        <div className="flex h-[calc(100%-4rem)] flex-col justify-between py-2">
          <div onClick={() => setOpen(false)}>
            <SidebarNav items={items} />
          </div>
          <div className="border-t p-3">
            <UserMenu user={user} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
