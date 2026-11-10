"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Rep = { id: string; firstName: string; lastName: string };

export function LeadFilters({
  reps,
  showPipelineAndStage = true,
}: {
  reps: Rep[];
  /** The Ads/Warm Approach pipeline pages already fix the pipeline (and show
   * stage as the board's columns), so they render only search/source/rep. */
  showPipelineAndStage?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlQ = searchParams.get("q") ?? "";
  const urlSource = searchParams.get("source") ?? "";
  const [q, setQ] = useState(urlQ);
  const [source, setSource] = useState(urlSource);

  /** Applies several params in one navigation. Two back-to-back single-param
   * calls would each start from the same stale `searchParams`, and the second
   * replace() would silently undo the first. */
  function setParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function setParam(key: string, value: string) {
    setParams({ [key]: value });
  }

  // Skip the very first run — avoids an unnecessary router.replace on every
  // page visit.
  const isFirstRender = useRef(true);
  const lastPushed = useRef({ q: urlQ, source: urlSource });
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      lastPushed.current = { q, source };
      setParams({ q, source });
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, source]);

  /*
   * These two boxes are the only filters whose state lives in the component
   * rather than in the URL, so anything that clears the URL from outside —
   * a filter chip's ✕, "Clear all", or the browser back button — used to
   * leave stale text sitting in the box while the list below ignored it.
   * Adopt an external change, but never fight the value we just wrote
   * ourselves (which would undo the user's own typing mid-debounce).
   */
  useEffect(() => {
    if (urlQ !== lastPushed.current.q) {
      lastPushed.current.q = urlQ;
      setQ(urlQ);
    }
    if (urlSource !== lastPushed.current.source) {
      lastPushed.current.source = urlSource;
      setSource(urlSource);
    }
  }, [urlQ, urlSource]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
      {/* Search comes first and is the widest control: it is what people reach
          for, and it was previously indistinguishable from the source box. */}
      <div className="grid flex-1 gap-1.5 lg:min-w-64">
        <Label htmlFor="leadSearch" className="text-xs font-medium text-muted-foreground">
          Search leads
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="leadSearch"
            type="search"
            placeholder="Name, company, email or phone"
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
        <Label htmlFor="leadSource" className="text-xs font-medium text-muted-foreground">
          Source
        </Label>
        <Input
          id="leadSource"
          placeholder="e.g. Instagram"
          className="h-9"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </div>

      {showPipelineAndStage && (
        <>
          <div className="grid gap-1.5 lg:w-44">
            <Label htmlFor="leadPipeline" className="text-xs font-medium text-muted-foreground">
              Pipeline
            </Label>
            <Select
              key={`pipeline-${searchParams.get("pipeline") ?? "all"}`}
              defaultValue={searchParams.get("pipeline") ?? "all"}
              onValueChange={(v) => setParam("pipeline", v ?? "all")}
            >
              <SelectTrigger id="leadPipeline" className="h-9 w-full">
                <SelectValue placeholder="All pipelines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pipelines</SelectItem>
                <SelectItem value="ADS">Ads</SelectItem>
                <SelectItem value="WARM_APPROACH">Warm Approach</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5 lg:w-44">
            <Label htmlFor="leadStage" className="text-xs font-medium text-muted-foreground">
              Stage
            </Label>
            <Select
              key={`stage-${searchParams.get("stage") ?? "all"}`}
              defaultValue={searchParams.get("stage") ?? "all"}
              onValueChange={(v) => setParam("stage", v ?? "all")}
            >
              <SelectTrigger id="leadStage" className="h-9 w-full">
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                <SelectGroup>
                  <SelectLabel>Ads pipeline</SelectLabel>
                  <SelectItem value="COLD">Cold</SelectItem>
                  <SelectItem value="WARM">Warm</SelectItem>
                  <SelectItem value="HOT">Hot</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Warm Approach pipeline</SelectLabel>
                  <SelectItem value="PLAN_MEET">Plan Meet</SelectItem>
                  <SelectItem value="PITCHED">Pitched</SelectItem>
                  <SelectItem value="PROPOSAL_SENT">Proposal Sent</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className="grid gap-1.5 lg:w-44">
        <Label htmlFor="leadRep" className="text-xs font-medium text-muted-foreground">
          Representative
        </Label>
        <Select
          key={`assignedRep-${searchParams.get("assignedRep") ?? "all"}`}
          defaultValue={searchParams.get("assignedRep") ?? "all"}
          onValueChange={(v) => setParam("assignedRep", v ?? "all")}
        >
          <SelectTrigger id="leadRep" className="h-9 w-full" aria-busy={isPending || undefined}>
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
