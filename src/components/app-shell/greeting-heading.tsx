"use client";

import { useSyncExternalStore } from "react";
import { getGreeting } from "@/lib/greeting";

// The greeting never changes after mount on its own (no external event fires
// it), so subscribe is a no-op — this hook is used purely for its two
// snapshot functions.
const noopSubscribe = () => () => {};

// The server only knows its own clock, not the visitor's timezone, so a
// server-computed greeting can say "Good evening" to someone whose local
// morning it still is. useSyncExternalStore lets us give the SSR pass a
// neutral, deterministic snapshot (avoiding a hydration mismatch) while the
// client snapshot reads the visitor's actual local clock.
export function GreetingHeading({ firstName }: { firstName: string }) {
  const greeting = useSyncExternalStore(
    noopSubscribe,
    () => getGreeting(),
    () => "Welcome back",
  );

  return (
    <h1 className="text-2xl font-semibold tracking-tight">
      {greeting}, {firstName}.
    </h1>
  );
}
