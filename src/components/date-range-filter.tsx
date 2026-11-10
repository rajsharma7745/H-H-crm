"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Shared by the dashboard and reports: Today / 7d / 30d / All time / Custom. */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const range = searchParams.get("range") ?? "30d";

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="range" className="text-xs text-muted-foreground">
          Date range
        </Label>
        <Select
          key={`range-${range}`}
          defaultValue={range}
          onValueChange={(v) =>
            // Leaving custom mode drops the now-meaningless from/to params.
            setParams(v === "custom" ? { range: v } : { range: v, from: null, to: null })
          }
        >
          <SelectTrigger id="range" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {range === "custom" && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="from"
              type="date"
              className="w-full sm:w-40"
              defaultValue={searchParams.get("from") ?? ""}
              onChange={(e) => setParams({ from: e.target.value || null })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="to"
              type="date"
              className="w-full sm:w-40"
              defaultValue={searchParams.get("to") ?? ""}
              onChange={(e) => setParams({ to: e.target.value || null })}
            />
          </div>
        </>
      )}
    </div>
  );
}
