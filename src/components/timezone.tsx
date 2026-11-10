"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { TIME_ZONE_COOKIE, TIME_ZONE_FIELD, browserTimeZone } from "@/lib/timezone";

const subscribe = () => () => {};

/** Browser zone on the client, "" during server render (avoids a hydration mismatch). */
function useBrowserTimeZone(): string {
  return useSyncExternalStore(subscribe, browserTimeZone, () => "");
}

/**
 * Hidden field carrying the browser's IANA zone, so the server can convert a
 * datetime-local wall-clock value to UTC using the zone the user typed it in.
 */
export function TimeZoneField() {
  const timeZone = useBrowserTimeZone();
  return <input type="hidden" name={TIME_ZONE_FIELD} value={timeZone} readOnly />;
}

/**
 * Publishes the browser's zone as a cookie so server components can render
 * dates in it. When the cookie was missing or stale, refreshes once so the
 * page re-renders in the right zone.
 */
export function TimeZoneSync({ serverTimeZone }: { serverTimeZone: string }) {
  const router = useRouter();
  useEffect(() => {
    const zone = browserTimeZone();
    if (zone === serverTimeZone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [serverTimeZone, router]);
  return null;
}
