"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

/** Fires a one-time toast based on a query param, then strips it from the URL. */
export function QueryToast({
  param,
  messages,
}: {
  param: string;
  messages: Record<string, { type: "success" | "error"; text: string }>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const value = searchParams.get(param);
    if (!value) return;
    const entry = messages[value];
    if (entry) {
      if (entry.type === "success") toast.success(entry.text);
      else toast.error(entry.text);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete(param);
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
