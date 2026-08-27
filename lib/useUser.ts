"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

// Shared client-side auth guard. The PIN lock (app-wide) is enforced by
// middleware.ts; this hook enforces the separate per-account Supabase Auth
// session and loads the caller's own profile row alongside it. Redirects to
// /login if there's no session.
export function useUser() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!data.user) {
        setLoading(false);
        router.push("/login");
        return;
      }

      setUserId(data.user.id);

      let { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      // Fallback path: if email confirmation was required, app/signup could
      // not create the profile row at signup time (no session yet). Create
      // a minimal one now on first successful login so the rest of the app
      // (which assumes every auth user has a profiles row) never breaks.
      // User can rename it any time from /profile.
      if (!prof) {
        const fallbackUsername = `${(data.user.email ?? "user").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_")}_${Math.floor(
          1000 + Math.random() * 9000
        )}`;
        const { data: created } = await supabase
          .from("profiles")
          .insert({ id: data.user.id, username: fallbackUsername })
          .select("*")
          .maybeSingle();
        prof = created;
      }

      if (!cancelled) {
        setProfile(prof as Profile | null);
        setLoading(false);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/login");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { userId, profile, loading, supabase };
}
