import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Visual placeholder only — the real notification system ships in Phase 10. */
export function NotificationsButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled
      aria-label="Notifications (coming soon)"
      title="Notifications — coming soon"
    >
      <Bell className="size-4" />
    </Button>
  );
}
