"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";

// Error boundaries must be Client Components. `retry` (stable since Next
// 16.3) re-renders the boundary's children without a full navigation.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState onRetry={retry} />;
}
