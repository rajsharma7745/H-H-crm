"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { BrandMark } from "@/components/app-shell/brand-mark";
import type { NavItemDef } from "@/lib/navigation";
import type { ComponentProps } from "react";

export function MobileNav({
  items,
  user,
}: {
  items: NavItemDef[];
  user: ComponentProps<typeof UserMenu>["user"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-lg" aria-label="Open navigation menu">
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left" className="w-[17rem] p-0">
        <SheetHeader className="h-16 shrink-0 justify-center border-b px-5">
          <SheetTitle className="text-left">
            <BrandMark />
          </SheetTitle>
        </SheetHeader>
        <div className="flex h-[calc(100%-4rem)] flex-col">
          <div className="flex-1 overflow-y-auto py-4">
            <SidebarNav items={items} onNavigate={() => setOpen(false)} />
          </div>
          <div className="shrink-0 border-t p-3">
            <UserMenu user={user} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
