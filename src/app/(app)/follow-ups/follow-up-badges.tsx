import { AlertTriangle, Phone, Mail, Users, MessageSquare, CircleDot, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FollowUpPriority, FollowUpStatus, FollowUpType } from "@prisma/client";

/**
 * One definition of what a follow-up's type, priority and status look like,
 * shared by the Follow-ups list, the lead detail page and the dashboard.
 *
 * These were three separate local lookup tables that had drifted into using
 * the same solid-black badge for "Completed" as for "High priority" and "Hot",
 * so the page's most and least urgent information looked identical.
 */
export const FOLLOW_UP_TYPE_LABEL: Record<FollowUpType, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  MESSAGE: "Message",
  OTHER: "Other",
};

export const FOLLOW_UP_TYPE_ICON: Record<FollowUpType, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  MESSAGE: MessageSquare,
  OTHER: CircleDot,
};

const PRIORITY_LABEL: Record<FollowUpPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const PRIORITY_VARIANT: Record<FollowUpPriority, "warning" | "secondary" | "outline"> = {
  HIGH: "warning",
  MEDIUM: "secondary",
  LOW: "outline",
};

const STATUS_LABEL: Record<FollowUpStatus, string> = {
  PENDING: "Open",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};
const STATUS_VARIANT: Record<FollowUpStatus, "info" | "success" | "outline"> = {
  PENDING: "info",
  COMPLETED: "success",
  CANCELLED: "outline",
};

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Low priority is the default and adds nothing, so it renders as nothing. */
export function FollowUpPriorityBadge({ priority }: { priority: FollowUpPriority }) {
  if (priority === "LOW") return null;
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABEL[priority]} priority</Badge>;
}

export function FollowUpTypeBadge({ type }: { type: FollowUpType }) {
  const Icon = FOLLOW_UP_TYPE_ICON[type];
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Icon className="size-3" aria-hidden="true" />
      {FOLLOW_UP_TYPE_LABEL[type]}
    </Badge>
  );
}

/**
 * Overdue is computed against the server's render clock, passed in explicitly,
 * so the badge can't differ between the server render and hydration.
 */
export function isFollowUpOverdue(
  followUp: { status: FollowUpStatus; dueAt: Date | string },
  now: Date,
): boolean {
  return followUp.status === "PENDING" && new Date(followUp.dueAt).getTime() < now.getTime();
}

export function OverdueBadge({ className }: { className?: string }) {
  return (
    <Badge variant="destructive" className={cn("gap-1", className)}>
      <AlertTriangle className="size-3" aria-hidden="true" />
      Overdue
    </Badge>
  );
}
