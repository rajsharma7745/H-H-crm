import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one place page width and page padding are decided.
 *
 * Every page used to hand-roll its own `mx-auto max-w-… px-4 py-10 sm:px-8`,
 * which had drifted apart (max-w-5xl vs 6xl, py-8 vs py-10) — including
 * between a page and its own loading.tsx, which showed up as a visible layout
 * shift when the real content arrived. Routes now pick a named width instead.
 */
const WIDTHS = {
  /** List/board pages that benefit from the extra column. */
  wide: "max-w-7xl",
  /** The default for most pages. */
  default: "max-w-6xl",
  /** Reading-oriented pages: lead detail, settings, profile. */
  narrow: "max-w-5xl",
} as const;

export function PageShell({
  children,
  width = "default",
  className,
}: {
  children: React.ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8", WIDTHS[width], className)}>
      {children}
    </div>
  );
}

/**
 * Title + one-line explanation + primary action, in that order, on every page.
 *
 * The description is not decoration: it is the line that tells somebody who
 * has never used a CRM what the page in front of them is for, so it is a
 * required prop rather than an optional one.
 */
export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  meta,
  className,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  /** Primary (and, at most, one or two secondary) actions for this page. */
  actions?: React.ReactNode;
  /** Renders a "back to …" link above the title. */
  backHref?: string;
  backLabel?: string;
  /** Badges or timestamps shown directly under the title. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {backLabel ?? "Back"}
        </Link>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {typeof title === "string" ? (
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          ) : (
            title
          )}
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          {meta}
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * A titled band inside a page, for grouping several cards under one heading
 * (used by Reports and the Dashboard to replace an undifferentiated wall of
 * panels with a scannable hierarchy).
 */
export function PageSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * The container every list page's search + filter controls sit in.
 *
 * Giving filters an explicit surface (rather than letting them float loose
 * above the table) makes it obvious at a glance that the list below is being
 * narrowed by something, and gives the active-filter chips somewhere to live.
 */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-3 shadow-xs sm:p-4", className)}>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

/** "12 of 48 leads" — tells you whether you are looking at everything or not. */
export function ResultCount({
  shown,
  total,
  noun,
  pluralNoun,
}: {
  shown: number;
  total: number;
  noun: string;
  pluralNoun?: string;
}) {
  // In the "X of Y" form the noun agrees with Y, not X — otherwise a single
  // match out of many reads as "1 of 8 lead".
  const plural = pluralNoun ?? `${noun}s`;
  const isAll = shown === total;
  const word = (isAll ? shown : total) === 1 ? noun : plural;

  return (
    <p className="text-xs text-muted-foreground" role="status">
      <span className="font-medium text-foreground">{shown}</span>
      {isAll ? ` ${word}` : ` of ${total} ${word}`}
    </p>
  );
}
