import Link from "next/link";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ClientNotFound() {
  return (
    <div className="mx-auto flex max-w-5xl px-4 py-16 sm:px-8">
      <EmptyState
        className="mx-auto"
        icon={Building2}
        title="Client not found"
        description="It may have been removed, or the link is incorrect."
        action={
          <Button
            variant="outline"
            className="mt-1"
            nativeButton={false}
            render={<Link href="/clients">Back to clients</Link>}
          />
        }
      />
    </div>
  );
}
