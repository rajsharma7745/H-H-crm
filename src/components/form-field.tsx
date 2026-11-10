import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Label + control + optional hint, with required fields actually marked.
 *
 * The forms previously had no way to tell a required field from an optional
 * one until the server rejected the submission, and every dialog spelled out
 * its own `grid gap-2` label wrapper, so spacing drifted between them.
 */
export function FormField({
  id,
  label,
  hint,
  required = false,
  className,
  children,
}: {
  /** Must match the control's `id` so the label is genuinely associated. */
  id: string;
  label: string;
  /** Short guidance shown under the control — used sparingly. */
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        )}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * A titled group of related fields.
 *
 * Uses a real fieldset/legend so the grouping is announced, not just drawn —
 * the long Add-lead form is much easier to work through when "Contact
 * details" and "Ads pipeline details" are stated rather than implied by a
 * border.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("grid gap-4 rounded-xl border bg-muted/30 p-3 sm:p-4", className)}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {description && <p className="-mt-2 text-xs text-muted-foreground">{description}</p>}
      {children}
    </fieldset>
  );
}

/**
 * Two fields side by side from `sm` up, stacked below it.
 *
 * Every dialog used a bare `grid-cols-2`, which held at 390px too — producing
 * two ~150px inputs with truncated labels on a phone.
 */
export function FormRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
