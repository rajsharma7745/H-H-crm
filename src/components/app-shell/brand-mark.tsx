import { cn } from "@/lib/utils";

/**
 * The H&H lockup. Previously copy-pasted into three places in the shell
 * (desktop sidebar, mobile header, mobile drawer) with slightly different
 * sizes each time.
 */
export function BrandMark({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-bold tracking-tight text-primary-foreground">
        H&amp;H
      </span>
      {showWordmark && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">H&amp;H CRM</span>
          <span className="mt-0.5 truncate text-[11px] text-muted-foreground">Lead management</span>
        </span>
      )}
    </span>
  );
}
