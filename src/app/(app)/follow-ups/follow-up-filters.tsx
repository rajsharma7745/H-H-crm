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

type Rep = { id: string; firstName: string; lastName: string };

export function FollowUpFilters({
  reps,
  /** The status filter only appears on the "All" view — every other view
   * already pins a status, so offering it there would just produce empty
   * results (see buildFollowUpWhere). */
  showStatus,
}: {
  reps: Rep[];
  showStatus: boolean;
}) {
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

  const isFirstRender = useRef(true);
  const lastPushed = useRef(urlQ);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      lastPushed.current = q;
      setParam("q", q);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Adopt a change made from outside this box — a filter chip's ✕, "Clear
  // all", or the back button — without fighting what we just wrote ourselves.
  useEffect(() => {
    if (urlQ !== lastPushed.current) {
      lastPushed.current = urlQ;
      setQ(urlQ);
    }
  }, [urlQ]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
      <div className="grid flex-1 gap-1.5 lg:min-w-64">
        <Label htmlFor="followUpSearch" className="text-xs font-medium text-muted-foreground">
          Search follow-ups
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="followUpSearch"
            type="search"
            placeholder="Follow-up title or lead name"
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

      <div className="grid gap-1.5 lg:w-40">
        <Label htmlFor="followUpPriority" className="text-xs font-medium text-muted-foreground">
          Priority
        </Label>
        <Select
          key={`priority-${searchParams.get("priority") ?? "all"}`}
          defaultValue={searchParams.get("priority") ?? "all"}
          onValueChange={(v) => setParam("priority", v ?? "all")}
        >
          <SelectTrigger id="followUpPriority" className="h-9 w-full">
            <SelectValue placeholder="Any priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any priority</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showStatus && (
        <div className="grid gap-1.5 lg:w-40">
          <Label htmlFor="followUpStatus" className="text-xs font-medium text-muted-foreground">
            Status
          </Label>
          <Select
            key={`status-${searchParams.get("status") ?? "all"}`}
            defaultValue={searchParams.get("status") ?? "all"}
            onValueChange={(v) => setParam("status", v ?? "all")}
          >
            <SelectTrigger id="followUpStatus" className="h-9 w-full">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="PENDING">Open</SelectItem>
              <SelectItem value="COMPLETED">Done</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-1.5 lg:w-44">
        <Label htmlFor="followUpRep" className="text-xs font-medium text-muted-foreground">
          Responsible
        </Label>
        <Select
          key={`assignedRep-${searchParams.get("assignedRep") ?? "all"}`}
          defaultValue={searchParams.get("assignedRep") ?? "all"}
          onValueChange={(v) => setParam("assignedRep", v ?? "all")}
        >
          <SelectTrigger id="followUpRep" className="h-9 w-full" aria-busy={isPending || undefined}>
            <SelectValue placeholder="Everyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {reps.map((rep) => (
              <SelectItem key={rep.id} value={rep.id}>
                {rep.firstName} {rep.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
