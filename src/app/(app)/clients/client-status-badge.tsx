import { Badge } from "@/components/ui/badge";
import type { ClientStatus } from "@prisma/client";

const STATUS_LABEL: Record<ClientStatus, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CHURNED: "Churned",
};

const STATUS_VARIANT: Record<ClientStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PROSPECT: "outline",
  ACTIVE: "default",
  PAUSED: "secondary",
  CHURNED: "destructive",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
