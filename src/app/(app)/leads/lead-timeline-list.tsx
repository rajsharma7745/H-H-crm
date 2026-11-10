import {
  Phone,
  Mail,
  Users,
  StickyNote,
  MessageSquare,
  GitBranch,
  UserCheck,
  Pencil,
  Sparkles,
  BellRing,
  CheckCircle2,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { TimelineEntry } from "@/lib/queries/lead-timeline";

/**
 * Icon and colour per entry type. The timeline was previously a flat list of
 * near-identical rows whose only distinguishing feature was a small grey tag,
 * which made a stage change, a logged phone call and a completed follow-up
 * equally hard to pick out. Keying an icon and a tint off the existing `tag`
 * means calls, meetings, notes, emails and system events are told apart at a
 * glance — while the tag text stays, so nothing depends on colour alone.
 */
const ENTRY_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  Call: { icon: Phone, className: "bg-info/10 text-info" },
  Email: { icon: Mail, className: "bg-info/10 text-info" },
  Meeting: { icon: Users, className: "bg-stage-plan-meet/10 text-stage-plan-meet" },
  Note: { icon: StickyNote, className: "bg-muted text-muted-foreground" },
  Activity: { icon: MessageSquare, className: "bg-muted text-muted-foreground" },
  "Stage change": { icon: GitBranch, className: "bg-primary/10 text-primary" },
  Assignment: { icon: UserCheck, className: "bg-primary/10 text-primary" },
  Edit: { icon: Pencil, className: "bg-muted text-muted-foreground" },
  Created: { icon: Sparkles, className: "bg-success/10 text-success" },
  "Follow-up due": { icon: BellRing, className: "bg-warning/10 text-warning" },
  "Follow-up done": { icon: CheckCircle2, className: "bg-success/10 text-success" },
  "Follow-up": { icon: CircleDot, className: "bg-muted text-muted-foreground" },
};

const FALLBACK_STYLE = { icon: CircleDot, className: "bg-muted text-muted-foreground" };

export function LeadTimelineList({
  entries,
  now,
  timeZone,
}: {
  entries: TimelineEntry[];
  now: Date;
  timeZone: string;
}) {
  return (
    <ol className="relative space-y-4">
      {/* The rail is decorative — the list semantics carry the meaning. */}
      <span aria-hidden="true" className="absolute bottom-2 left-[15px] top-2 w-px bg-border" />

      {entries.map((entry) => {
        const style = ENTRY_STYLE[entry.tag] ?? FALLBACK_STYLE;
        const Icon = style.icon;

        return (
          <li key={entry.id} className="relative flex gap-3">
            <span
              className={cn(
                "z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                style.className,
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="min-w-0 text-sm">
                  {/* An event with nobody attached (e.g. a follow-up nobody owns yet) has
                      no actor to name; capitalise the sentence instead of inventing "Someone". */}
                  {entry.kind !== "activity" && !entry.actorName ? (
                    <span className="text-muted-foreground">
                      {entry.label.charAt(0).toUpperCase() + entry.label.slice(1)}
                    </span>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">
                        {entry.kind === "activity" ? entry.label : entry.actorName}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {entry.kind === "activity" ? entry.tag : entry.label}
                      </span>
                    </>
                  )}
                </p>
                <p className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(entry.at, timeZone)}>
                  {formatRelative(entry.at, now)}
                </p>
              </div>

              {entry.kind === "activity" && entry.actorName && (
                <p className="mt-0.5 text-xs text-muted-foreground">Logged by {entry.actorName}</p>
              )}

              {entry.detail && (
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-foreground/80">
                  {entry.detail}
                </p>
              )}

              <p className="mt-1 text-[11px] text-muted-foreground/70">{formatDateTime(entry.at, timeZone)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
