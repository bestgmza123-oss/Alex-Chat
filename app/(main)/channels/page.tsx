"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/lib/i18n/context";
import type { Chat } from "@/lib/types";

type ChatWithMember = Chat & {
  otherUser?: { id: string; username: string } | null;
};

export default function ChannelsPage() {
  const { userId, loading: userLoading } = useUser();
  const { t } = useTranslations();
  const supabase = createClient();
  const [chats, setChats] = useState<ChatWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchMode, setSearchMode] = useState<"username" | "code">("username");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || loading) return;
    let cancelled = false;

    async function loadChats() {
      const { data: memberships } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", userId);

      if (!memberships || memberships.length === 0) {
        setChats([]); setLoading(false); return;
      }

      const chatIds = memberships.map((m) => m.chat_id);
      const { data: chatRows } = await supabase
        .from("chats")
        .select("*")
        .in("id", chatIds)
        .eq("is_group", false)
        .order("created_at", { ascending: false });

      if (!chatRows) { setChats([]); setLoading(false); return; }

      const enriched: ChatWithMember[] = await Promise.all(
        chatRows.map(async (chat) => {
          const { data: members } = await supabase
            .from("chat_members")
            .select("user_id")
            .eq("chat_id", chat.id)
            .neq("user_id", userId);
          const otherId = members?.[0]?.user_id;
          let otherUser = null;
          if (otherId) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("id, username")
              .eq("id", otherId)
              .maybeSingle();
            otherUser = prof;
          }
          return { ...chat, otherUser };
        })
      );

      if (!cancelled) { setChats(enriched); setLoading(false); }
    }

    loadChats();
    return () => { cancelled = true; };
  }, [userId, loading, supabase]);

  async function startDM(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !searchInput.trim()) return;
    setSearching(true);
    setError(null);

    let targetId: string | null = null;

    if (searchMode === "username") {
      // Search by username
      const { data: target } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("username", searchInput.trim().toLowerCase())
        .maybeSingle();
      if (!target) { setSearching(false); setError(t("channels_not_found")); return; }
      if (target.id === userId) { setSearching(false); setError(t("channels_self_error")); return; }
      targetId = target.id;
    } else {
      // Search by access code
      const { data: target } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("access_code", searchInput.trim().toUpperCase())
        .maybeSingle();
      if (!target) { setSearching(false); setError(t("channels_not_found")); return; }
      if (target.id === userId) { setSearching(false); setError(t("channels_self_error")); return; }
      targetId = target.id;
    }

    // Check if DM already exists
    const myMemberships = await supabase
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", userId);

    if (myMemberships.data) {
      for (const m of myMemberships.data) {
        const { data: chat } = await supabase
          .from("chats")
          .select("id")
          .eq("id", m.chat_id)
          .eq("is_group", false)
          .maybeSingle();
        if (chat) {
          const { data: otherMember } = await supabase
            .from("chat_members")
            .select("user_id")
            .eq("chat_id", chat.id)
            .eq("user_id", targetId)
            .maybeSingle();
          if (otherMember) {
            setSearching(false);
            window.location.href = `/channels/${chat.id}`;
            return;
          }
        }
      }
    }    // Create new DM using SECURITY DEFINER function (bypasses RLS)
    const { data: chatId, error: createErr } = await supabase
      .rpc("create_chat_with_member", {
        p_created_by: userId,
        p_is_group: false,
      });

    if (createErr || !chatId) {
      setSearching(false);
      setError(t("channels_create_error"));
      return;
    }

    // Add the other member using SECURITY DEFINER function
    await supabase.rpc("join_chat", { p_chat_id: chatId, p_user_id: targetId });

    setSearching(false);
    window.location.href = `/channels/${chatId}`;
  }

  if (userLoading) {
    return <p className="text-muted text-xs p-6 animate-pulse">{t("gen_loading")}</p>;
  }

  return (
    <div className="p-4 md:p-6 max-w-lg pb-24 md:pb-6">
      <h1 className="font-display font-bold text-sm tracking-widest text-text mb-1 glow-cyan">
        &gt; {t("channels_title")}
      </h1>
      <p className="text-muted text-xs mb-5">{t("channels_subtitle")}</p>

      {/* ═══ Search Mode Toggle ═══ */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setSearchMode("username")}
          className={`flex-1 py-2 text-[10px] tracking-widest rounded border transition-all ${
            searchMode === "username"
              ? "border-cyan text-cyan bg-cyan/10"
              : "border-border text-muted hover:border-cyan/30"
          }`}
        >
          @ username
        </button>
        <button
          onClick={() => setSearchMode("code")}
          className={`flex-1 py-2 text-[10px] tracking-widest rounded border transition-all ${
            searchMode === "code"
              ? "border-magenta text-magenta bg-magenta/10"
              : "border-border text-muted hover:border-magenta/30"
          }`}
        >
          # code
        </button>
      </div>

      {/* ═══ Search Form ═══ */}
      <form onSubmit={startDM} className="flex gap-2 mb-6">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={searchMode === "username" ? t("channels_search_placeholder") : "ABC123..."}
          className={`field flex-1 ${searchMode === "code" ? "uppercase tracking-widest font-display" : ""}`}
          maxLength={searchMode === "code" ? 6 : 50}
        />
        <button
          type="submit"
          disabled={searching || !searchInput.trim()}
          className="shrink-0 border border-cyan text-cyan px-3 py-2 rounded text-xs tracking-widest hover:bg-cyan hover:text-bg transition btn-cyber disabled:opacity-40"
        >
          {searching ? "..." : t("channels_connect")}
        </button>
      </form>

      {error && <p className="text-danger text-xs mb-4">{error}</p>}

      {/* ═══ Chat List ═══ */}
      {loading ? (
        <p className="text-muted text-xs animate-pulse">{t("gen_loading")}</p>
      ) : chats.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-3 opacity-30">📡</div>
          <p className="text-muted text-xs">{t("channels_empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/channels/${chat.id}`}
              className="block border border-border rounded px-4 py-3 hover:border-cyan/30 hover:bg-cyan/5 transition-all hover-lift cyber-card"
            >
              <p className="text-sm text-text font-body">
                {chat.otherUser?.username ?? "unknown operator"}
              </p>
              <p className="text-[10px] text-muted tracking-wider mt-1">
                CHANNEL · {new Date(chat.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
