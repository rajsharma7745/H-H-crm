import Link from "next/link";
import { LogOut, User, ChevronsUpDown } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export function UserMenu({
  user,
}: {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl: string | null;
    role: { name: string };
  };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800">
        <Avatar className="size-8">
          <AvatarImage src={user.profileImageUrl ?? undefined} alt="" />
          <AvatarFallback className="text-xs">
            {initials(user.firstName, user.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between font-normal">
          <span className="text-xs text-muted-foreground">Signed in as</span>
          <Badge variant="secondary" className="text-[10px]">
            {user.role.name}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link href="/profile">
              <User className="size-4" />
              Profile
            </Link>
          }
        />
        <DropdownMenuSeparator />
        <form action={logoutAction} className="contents">
          <DropdownMenuItem
            variant="destructive"
            render={
              <button type="submit" className="w-full text-left">
                <LogOut className="size-4" />
                Sign out
              </button>
            }
          />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
