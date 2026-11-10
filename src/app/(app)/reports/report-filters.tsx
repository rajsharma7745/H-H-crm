"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Rep = { id: string; firstName: string; lastName: string };

/** Pipeline + representative filters. The date range comes from the shared
 * DateRangeFilter, which writes the same query string. */
export function ReportFilters({ reps }: { reps: Rep[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="reportPipeline" className="text-xs text-muted-foreground">
          Pipeline
        </Label>
        <Select
          key={`pipeline-${searchParams.get("pipeline") ?? "all"}`}
          defaultValue={searchParams.get("pipeline") ?? "all"}
          onValueChange={(v) => setParam("pipeline", v ?? "all")}
        >
          <SelectTrigger id="reportPipeline" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both pipelines</SelectItem>
            <SelectItem value="ADS">Ads</SelectItem>
            <SelectItem value="WARM_APPROACH">Warm Approach</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="reportRep" className="text-xs text-muted-foreground">
          Representative
        </Label>
        <Select
          key={`assignedRep-${searchParams.get("assignedRep") ?? "all"}`}
          defaultValue={searchParams.get("assignedRep") ?? "all"}
          onValueChange={(v) => setParam("assignedRep", v ?? "all")}
        >
          <SelectTrigger id="reportRep" className="w-full sm:w-44">
            <SelectValue />
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
