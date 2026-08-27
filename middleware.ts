import { NextRequest, NextResponse } from "next/server";
import { PIN_COOKIE_NAME, isSessionFresh } from "@/lib/pin-session";

// Runs on every request. Anything except /lock and its API route requires a
// fresh PIN session cookie; being idle for more than 5 minutes invalidates it
// (see lib/pin-session.ts), bouncing the user back to /lock.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPath =
    pathname.startsWith("/lock") ||
    pathname.startsWith("/api/pin") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (isPublicPath) return NextResponse.next();

  const cookie = req.cookies.get(PIN_COOKIE_NAME)?.value;

  if (!isSessionFresh(cookie)) {
    const url = req.nextUrl.clone();
    const next = url.pathname + url.search;
    url.pathname = "/lock";
    url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return NextResponse.redirect(url);
  }

  // Sliding expiry: refresh the timestamp on any activity so an actively
  // used session doesn't get logged out mid-use.
  const res = NextResponse.next();
  res.cookies.set(PIN_COOKIE_NAME, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24, // cookie itself can live a day; freshness check is what matters
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
