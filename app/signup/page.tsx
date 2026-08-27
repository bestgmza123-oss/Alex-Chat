"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/lib/i18n/context";

export default function SignupPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanUsername = username.trim().toLowerCase();

    // Check username availability
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existing) {
      setLoading(false);
      setError("that username is already taken.");
      return;
    }

    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr) { setLoading(false); setError(t("signup_error")); return; }

    if (authData.user) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];

      await supabase.from("profiles").insert({
        id: authData.user.id,
        username: cleanUsername,
        bio: "",
        access_code: code,
      });
    }

    setLoading(false);
    router.push("/channels");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display font-bold text-lg tracking-widest text-text mb-1 text-center glow-cyan">
          &gt; {t("signup_title")}
        </h1>
        <div className="h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent mb-8" />

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-[10px] tracking-widest text-muted mb-1">{t("signup_username")}</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="field"
              required
              minLength={3}
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-widest text-muted mb-1">{t("signup_email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-widest text-muted mb-1">{t("signup_password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              required
              minLength={6}
            />
          </div>

          {error && <p className="text-danger text-xs glow-magenta">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-cyan text-cyan py-3 rounded text-xs tracking-widest hover:bg-cyan hover:text-bg transition btn-cyber disabled:opacity-40"
          >
            {loading ? "..." : t("signup_button")}
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-6">
          {t("signup_has_account")}{" "}
          <Link href="/login" className="text-cyan hover:underline">
            {t("signup_login_link")}
          </Link>
        </p>

        <p className="text-center text-[9px] text-muted/30 mt-8 tracking-wider">
          Developed by Alexander_Weng
        </p>
      </div>
    </div>
  );
}
