import "server-only";
import { cookies } from "next/headers";
import { TIME_ZONE_COOKIE, resolveTimeZone } from "@/lib/timezone";

/**
 * The viewer's timezone for server-rendered dates, as reported by their
 * browser (see TimeZoneSync). Falls back to UTC — never the server's zone —
 * on a first request before the cookie exists.
 */
export async function getViewerTimeZone(): Promise<string> {
  const store = await cookies();
  return resolveTimeZone(store.get(TIME_ZONE_COOKIE)?.value);
}
