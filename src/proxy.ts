import { NextResponse, type NextRequest } from "next/server";

/**
 * Coarse, edge-safe route gate: redirects based on cookie *presence* only.
 *
 * This is a UX convenience, NOT the security boundary — the proxy can't
 * safely touch the database here, so it never validates the session token
 * itself. The real check (does this session exist, is it expired, is the
 * user still active, do they have the right role/permission) happens in
 * requireAuth()/requireRole()/requirePermission() on the server, on every
 * protected layout, page and server action. Never trust this file alone.
 */

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "hhcrm_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/admin",
  "/settings",
  "/leads",
  "/follow-ups",
  "/reports",
  "/clients",
];

// Note: there is deliberately no "already logged in -> bounce away from
// /login" rule here. That direction needs a real DB-backed session check
// (done in src/app/(auth)/layout.tsx via getCurrentUser()) — doing it here
// off cookie presence alone can loop forever against the redirect below
// whenever the cookie is stale (expired/deleted session, reset dev DB).

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Skip static assets and image optimization files.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
