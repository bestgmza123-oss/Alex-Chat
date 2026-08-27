"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/lib/i18n/context";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authErr) {
      setError(t("login_error"));
      return;
    }
    router.push("/channels");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display font-bold text-lg tracking-widest text-text mb-1 text-center glow-cyan">
          &gt; {t("login_title")}
        </h1>
        <div className="h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent mb-8" />

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] tracking-widest text-muted mb-1">{t("login_email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-widest text-muted mb-1">{t("login_password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              required
            />
          </div>

          {error && <p className="text-danger text-xs glow-magenta">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-cyan text-cyan py-3 rounded text-xs tracking-widest hover:bg-cyan hover:text-bg transition btn-cyber disabled:opacity-40"
          >
            {loading ? "..." : t("login_button")}
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-6">
          {t("login_no_account")}{" "}
          <Link href="/signup" className="text-cyan hover:underline">
            {t("login_signup_link")}
          </Link>
        </p>

        <p className="text-center text-[9px] text-muted/30 mt-8 tracking-wider">
          Developed by Alexander_Weng
        </p>
      </div>
    </div>
  );
}
