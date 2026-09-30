/**
 * Paths that require a signed-in user (brain/frontend-structure.md §3).
 * Signed-out visitors are sent to /signin?next=<path>.
 */
export const PROTECTED_PREFIXES = ["/dashboard", "/bookings", "/messages", "/listings/new"];

/** Auth pages a signed-in user doesn't need (they're sent home instead). */
export const GUEST_ONLY_PATHS = ["/signin", "/signup"];

export function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Only allow same-site relative redirects (blocks open redirects like //evil.com). */
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
