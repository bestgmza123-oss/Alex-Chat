"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import { useTranslations } from "@/lib/i18n/context";

const BOOT_LINES = [
  "INITIALIZING SECURE CHANNEL...",
  "LOADING ENCRYPTION MODULES...",
  "VERIFYING NODE INTEGRITY...",
  "ESTABLISHING MESH NETWORK...",
  "AUTH REQUIRED —",
];

function LockPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/channels";
  const { t } = useTranslations();

  const [pin, setPin] = useState("");
  const [bootIndex, setBootIndex] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bootIndex >= BOOT_LINES.length) {
      setShowInput(true);
      return;
    }
    const timer = setTimeout(() => setBootIndex((i) => i + 1), 500);
    return () => clearTimeout(timer);
  }, [bootIndex]);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || loading) return;
    setLoading(true);
    setError(false);

    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        router.push(next);
        router.refresh();
      } else {
        setError(true);
        setPin("");
        setTimeout(() => setError(false), 600);
      }
    } catch {
      setError(true);
      setTimeout(() => setError(false), 600);
    } finally {
      setLoading(false);
    }
  }

  const bootTexts = [t("lock_init"), t("lock_loading"), t("lock_verifying"), "ESTABLISHING MESH NETWORK...", t("lock_auth_required")];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8 animate-pulse-glow rounded-full inline-flex mx-auto">
          <Logo size={64} />
        </div>

        {/* Boot lines */}
        <div className="mb-6 space-y-1">
          {bootTexts.slice(0, bootIndex).map((line, i) => (
            <p
              key={i}
              className={`text-xs font-body tracking-wider ${
                i === bootIndex - 1 && i === bootTexts.length - 1
                  ? "text-cyan glow-cyan"
                  : "text-muted"
              }`}
            >
              &gt; {line}
            </p>
          ))}
          {bootIndex < bootTexts.length && (
            <span className="inline-block w-2 h-3 bg-cyan animate-blink glow-cyan-strong" />
          )}
        </div>

        {/* PIN Input */}
        {showInput && (
          <form onSubmit={submitPin} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                maxLength={12}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={t("lock_placeholder")}
                className={`field text-center text-lg tracking-[0.5em] font-display ${
                  error ? "border-danger animate-cyber-glitch border-glow-magenta" : "border-glow-cyan"
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !pin.trim()}
              className="w-full border border-cyan text-cyan py-3 rounded text-xs tracking-widest hover:bg-cyan hover:text-bg transition btn-cyber disabled:opacity-40"
            >
              {loading ? "..." : t("lock_enter")}
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-[9px] text-muted/30 mt-8 tracking-wider">
          Developed by Alexander_Weng
        </p>
      </div>
    </div>
  );
}

export default function LockPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted text-xs animate-pulse">LOADING...</p></div>}>
      <LockPageInner />
    </Suspense>
  );
}
