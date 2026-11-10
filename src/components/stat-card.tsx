import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A single KPI: label, the number, and a plain-English line explaining what
 * the number counts. The explanation is required — every metric on this
 * dashboard has a precise definition, and a bare number with no definition is
 * exactly what makes an internal dashboard untrustworthy.
 *
 * `tone` exists so genuinely urgent metrics (overdue work) and genuinely good
 * ones (won deals) don't sit at the same visual weight as everything else.
 */
const TONES = {
  neutral: { icon: "bg-muted text-muted-foreground", value: "text-foreground" },
  brand: { icon: "bg-primary/10 text-primary", value: "text-foreground" },
  success: { icon: "bg-success/10 text-success", value: "text-foreground" },
  warning: { icon: "bg-warning/10 text-warning", value: "text-foreground" },
  danger: { icon: "bg-destructive/10 text-destructive", value: "text-destructive" },
} as const;

export type StatTone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "neutral",
  emphasise = false,
}: {
  label: string;
  value: React.ReactNode;
  note: string;
  icon: LucideIcon;
  tone?: StatTone;
  /** Draws the tone's accent around the whole card, not just the icon. */
  emphasise?: boolean;
}) {
  const styles = TONES[tone];

  return (
    <Card
      size="sm"
      className={cn(
        "transition-shadow hover:shadow-sm",
        emphasise && tone === "danger" && "bg-destructive/[0.03] ring-destructive/25",
        emphasise && tone === "success" && "bg-success/[0.03] ring-success/25",
      )}
    >
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("tabular-metric text-2xl font-semibold", styles.value)}>{value}</p>
          <p className="text-xs leading-snug text-muted-foreground">{note}</p>
        </div>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}
