import Link from "next/link";
import { Target } from "lucide-react";
import { EmptyPanel } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export default function LeadNotFound() {
  return (
    <PageShell>
      <EmptyPanel
        icon={Target}
        title="That lead doesn't exist"
        description="It may have been deleted, or the link you followed is incorrect."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/leads">Back to all leads</Link>}
          />
        }
      />
    </PageShell>
  );
}
