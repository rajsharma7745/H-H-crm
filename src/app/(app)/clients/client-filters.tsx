"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClientFilters({ owners }: { owners: { id: string; firstName: string; lastName: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  // Skip the very first run — effects fire on mount too, and `q` already
  // matches the URL then, so debouncing it would just cost every page visit
  // an extra, unnecessary router.replace.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => setParam("q", q), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, contact or email..."
          className="pl-8"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Select
        // Keying on the current param forces a remount (and a fresh
        // defaultValue) when the URL changes from outside this component —
        // e.g. browser back/forward — since Base UI's Select is uncontrolled
        // and won't otherwise notice searchParams changing under it.
        key={`status-${searchParams.get("status") ?? "all"}`}
        defaultValue={searchParams.get("status") ?? "all"}
        onValueChange={(v) => setParam("status", v ?? "all")}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="PROSPECT">Prospect</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="PAUSED">Paused</SelectItem>
          <SelectItem value="CHURNED">Churned</SelectItem>
        </SelectContent>
      </Select>

      <Select
        key={`owner-${searchParams.get("owner") ?? "all"}`}
        defaultValue={searchParams.get("owner") ?? "all"}
        onValueChange={(v) => setParam("owner", v ?? "all")}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="All owners" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All owners</SelectItem>
          {owners.map((owner) => (
            <SelectItem key={owner.id} value={owner.id}>
              {owner.firstName} {owner.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
