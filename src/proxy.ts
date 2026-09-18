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

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/admin", "/settings"];
const AUTH_ONLY_PAGES = ["/login", "/forgot-password", "/reset-password"];

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

  const isAuthOnlyPage = AUTH_ONLY_PAGES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isAuthOnlyPage && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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
