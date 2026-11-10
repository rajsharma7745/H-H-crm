"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function UserFilters({ roles }: { roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(urlQ);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  const lastPushed = useRef(urlQ);
  useEffect(() => {
    const timeout = setTimeout(() => {
      lastPushed.current = q;
      setParam("q", q);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Adopt a change made from outside the box (back button, cleared URL).
  useEffect(() => {
    if (urlQ !== lastPushed.current) {
      lastPushed.current = urlQ;
      setQ(urlQ);
    }
  }, [urlQ]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="grid flex-1 gap-1.5 sm:min-w-56">
        <Label htmlFor="userSearch" className="text-xs font-medium text-muted-foreground">
          Search people
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="userSearch"
            type="search"
            placeholder="Name or email"
            className="h-9 pl-8 pr-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-1.5 sm:w-44">
        <Label htmlFor="userRole" className="text-xs font-medium text-muted-foreground">
          Role
        </Label>
        <Select
          key={`role-${searchParams.get("role") ?? "all"}`}
          defaultValue={searchParams.get("role") ?? "all"}
          onValueChange={(v) => setParam("role", v ?? "all")}
        >
          <SelectTrigger id="userRole" className="h-9 w-full">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5 sm:w-40">
        <Label htmlFor="userStatus" className="text-xs font-medium text-muted-foreground">
          Access
        </Label>
        <Select
          key={`status-${searchParams.get("status") ?? "all"}`}
          defaultValue={searchParams.get("status") ?? "all"}
          onValueChange={(v) => setParam("status", v ?? "all")}
        >
          <SelectTrigger id="userStatus" className="h-9 w-full" aria-busy={isPending || undefined}>
            <SelectValue placeholder="Everyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="ACTIVE">Can sign in</SelectItem>
            <SelectItem value="INACTIVE">Access revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
