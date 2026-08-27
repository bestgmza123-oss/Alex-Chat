"use client";

import { useEffect, useState } from "react";

const TOTAL_MS = 10 * 60 * 1000;

/**
 * Renders a small mm:ss + ring countdown for a message, purely from its
 * expires_at timestamp. No server round-trip: every client independently
 * computes remaining time, so this never needs to touch — and therefore
 * never risks clobbering — any other component's state (see PROJECT.md
 * note about the sync-overwrite bug from a previous project).
 *
 * Calls onExpire() once, client-side, so the parent can immediately hide the
 * message from the UI without waiting for the next cron sweep server-side.
 */
export default function MessageCountdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: string; // ISO timestamp
  onExpire?: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );
  const [firedExpire, setFiredExpire] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      const rem = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemainingMs(rem);
      if (rem === 0 && !firedExpire) {
        setFiredExpire(true);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [expiresAt, firedExpire, onExpire]);

  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  const pct = remainingMs / TOTAL_MS;

  const color =
    remainingMs < 60_000 ? "text-danger" : remainingMs < 180_000 ? "text-magenta" : "text-cyan";

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color} font-body`}>
      <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={2 * Math.PI * 7} strokeDashoffset={2 * Math.PI * 7 * (1 - pct)} strokeLinecap="round" transform="rotate(-90 8 8)" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      </svg>
      {mm}:{ss}
    </span>
  );
}
