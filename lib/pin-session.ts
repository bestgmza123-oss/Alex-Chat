// Shared-PIN "app lock" session handling.
//
// Design: one PIN for the whole site (stored server-side only, as an env var
// hash — never shipped to the client). On correct entry, the server sets an
// httpOnly cookie `alex_pin_session` containing a signed timestamp. Every
// request through middleware.ts checks that the cookie exists AND that less
// than IDLE_TIMEOUT_MS has passed since the last activity; if idle too long,
// the cookie is treated as invalid and the user is bounced back to /lock.
//
// NOTE: this is a "keep strangers out of a private tool" lock, not
// cryptographic-grade security — matches the brief (shared house-key PIN for
// a 10-20 person private app), not a multi-tenant security boundary.

export const PIN_COOKIE_NAME = "alex_pin_session";
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function isSessionFresh(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const lastActive = Number(cookieValue);
  if (Number.isNaN(lastActive)) return false;
  return Date.now() - lastActive < IDLE_TIMEOUT_MS;
}
