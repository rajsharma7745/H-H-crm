"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ActiveFilter = {
  /** The query-string key this chip removes. */
  key: string;
  /** What the filter is ("Stage"), shown before the value. */
  label: string;
  /** The human-readable value ("Proposal Sent"), not the raw enum. */
  display: string;
};

/**
 * Shows which filters are currently narrowing a list, and lets them be
 * removed one at a time or all at once.
 *
 * Before this, an empty list and a heavily-filtered list looked identical:
 * the only clue was remembering what you had typed into a dropdown further up
 * the page. Filters that can be seen can be undone.
 *
 * Parents compute `filters` server-side so each chip can show a resolved
 * label ("Priya Nair") rather than the id that is actually in the URL.
 */
export function ActiveFilters({
  filters,
  /** Keys to clear on "Clear all" beyond the chips — e.g. a free-text search. */
  alsoClear = [],
}: {
  filters: ActiveFilter[];
  alsoClear?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (filters.length === 0) return null;

  function apply(params: URLSearchParams) {
    startTransition(() => router.replace(params.size ? `${pathname}?${params.toString()}` : pathname));
  }

  function removeFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    apply(params);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const filter of filters) params.delete(filter.key);
    for (const key of alsoClear) params.delete(key);
    apply(params);
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={isPending || undefined}>
      <span className="text-xs font-medium text-muted-foreground">Filtered by</span>

      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => removeFilter(filter.key)}
          disabled={isPending}
          className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:opacity-50"
        >
          <span className="text-muted-foreground group-hover:text-destructive/80">{filter.label}:</span>
          <span className="max-w-40 truncate">{filter.display}</span>
          <X className="size-3 shrink-0" aria-hidden="true" />
          <span className="sr-only">Remove the {filter.label} filter</span>
        </button>
      ))}

      <Button variant="ghost" size="xs" onClick={clearAll} disabled={isPending}>
        Clear all
      </Button>
    </div>
  );
}
