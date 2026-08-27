"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/lib/i18n/context";

type Notification = {
  id: string;
  from_user_id: string;
  type: "mention_post" | "mention_chat";
  ref_id: string;
  read: boolean;
  created_at: string;
  from_user?: { username: string };
};

export default function NotificationsPage() {
  const { userId, loading: userLoading } = useUser();
  const { t } = useTranslations();
  const supabase = createClient();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("*, from_user:profiles!notifications_from_user_id_fkey(username)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!cancelled && data) {
        setNotifs(data as unknown as Notification[]);
        setLoading(false);

        // Mark all as read
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", userId)
          .eq("read", false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, supabase]);

  if (userLoading) {
    return <p className="text-muted text-xs p-6">{t("gen_loading")}</p>;
  }

  return (
    <div className="p-4 md:p-6 max-w-lg pb-24 md:pb-6">
      <h1 className="font-display font-bold text-sm tracking-widest text-text mb-1 glow-cyan">
        &gt; {t("notif_title")}
      </h1>

      {loading ? (
        <p className="text-muted text-xs mt-4">{t("gen_loading")}</p>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-3xl mb-3 opacity-30">🔔</div>
          <p className="text-muted text-xs">{t("notif_empty")}</p>
        </div>
      ) : (
        <div className="space-y-2 mt-4">
          {notifs.map((n) => (
            <Link
              key={n.id}
              href={n.type === "mention_post" ? "/feed" : "/channels"}
              className={`block border rounded px-4 py-3 transition-all hover-lift ${
                n.read
                  ? "border-border"
                  : "border-cyan/30 bg-cyan/5"
              }`}
            >
              <p className="text-xs text-text font-body">
                <span className="text-cyan">{n.from_user?.username ?? "?"}</span>{" "}
                {n.type === "mention_post" ? t("notif_mention_post") : t("notif_mention_chat")}
              </p>
              <p className="text-[10px] text-muted/50 mt-1">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
