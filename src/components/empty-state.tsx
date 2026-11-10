import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The app's one empty state. Every empty region says the same three things in
 * the same order — what is empty, why it is empty, and the one thing you can
 * do about it — so a blank area never reads as a broken page.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "default",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** "sm" for empty regions inside a card or a board column. */
  size?: "default" | "sm";
  className?: string;
}) {
  const small = size === "sm";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        small ? "gap-1.5 px-4 py-6" : "gap-2 px-6 py-12",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
          small ? "size-8" : "size-11",
        )}
      >
        <Icon className={small ? "size-4" : "size-5"} aria-hidden="true" />
      </div>
      <p className={cn("font-medium text-foreground", small ? "text-xs" : "text-sm")}>{title}</p>
      {description && (
        <p className={cn("max-w-sm text-muted-foreground", small ? "text-xs" : "text-sm")}>{description}</p>
      )}
      {action && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

/** EmptyState wrapped in the dashed panel used when a whole list is empty. */
export function EmptyPanel(props: React.ComponentProps<typeof EmptyState>) {
  return (
    <div className="rounded-xl border border-dashed bg-card/50">
      <EmptyState {...props} />
    </div>
  );
}
