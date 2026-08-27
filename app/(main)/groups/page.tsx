"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/lib/i18n/context";
import type { Chat, Group } from "@/lib/types";

type GroupWithChat = Group & Chat;

export default function GroupsPage() {
  const { userId, loading: userLoading } = useUser();
  const { t } = useTranslations();
  const supabase = createClient();
  const [groups, setGroups] = useState<GroupWithChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || loading) return;
    let cancelled = false;

    async function loadGroups() {
      const { data: memberships } = await supabase
        .from("chat_members").select("chat_id").eq("user_id", userId);

      if (!memberships || memberships.length === 0) { setGroups([]); setLoading(false); return; }

      const chatIds = memberships.map((m) => m.chat_id);
      const { data: chatRows } = await supabase
        .from("chats")
        .select("*, groups!inner(*)")
        .in("id", chatIds)
        .eq("is_group", true)
        .order("created_at", { ascending: false });

      if (!chatRows) { setGroups([]); setLoading(false); return; }

      const enriched: GroupWithChat[] = chatRows.map((row: any) => ({
        chat_id: row.id, invite_code: row.groups.invite_code,
        created_by: row.groups.created_by, created_at: row.groups.created_at,
        id: row.id, is_group: true, name: row.name,
      }));

      if (!cancelled) { setGroups(enriched); setLoading(false); }
    }

    loadGroups();
    return () => { cancelled = true; };
  }, [userId, loading, supabase]);

  function generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !newGroupName.trim()) return;
    setCreating(true); setError(null);

    const { data: chat, error: chatErr } = await supabase
      .from("chats").insert({ created_by: userId, is_group: true, name: newGroupName.trim() })
      .select("id").single();

    if (chatErr || !chat) { setCreating(false); setError(chatErr?.message ?? t("channels_create_error")); return; }

    const code = generateInviteCode();
    await supabase.from("groups").insert({ chat_id: chat.id, invite_code: code, created_by: userId });
    await supabase.from("chat_members").insert({ chat_id: chat.id, user_id: userId });

    setCreating(false);
    setSuccess(t("groups_created") + code);
    setNewGroupName("");
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !inviteCode.trim()) return;
    setJoining(true); setError(null); setSuccess(null);

    const code = inviteCode.trim().toUpperCase();
    const { data: group, error: findErr } = await supabase
      .from("groups").select("chat_id").eq("invite_code", code).maybeSingle();

    if (findErr || !group) { setJoining(false); setError(t("groups_invalid_code")); return; }

    const { data: existing } = await supabase
      .from("chat_members").select("chat_id")
      .eq("chat_id", group.chat_id).eq("user_id", userId).maybeSingle();

    if (existing) { setJoining(false); window.location.href = `/groups/${group.chat_id}`; return; }

    const { error: joinErr } = await supabase.from("chat_members").insert({ chat_id: group.chat_id, user_id: userId });
    setJoining(false);
    if (joinErr) { setError(joinErr.message); return; }
    window.location.href = `/groups/${group.chat_id}`;
  }

  if (userLoading) return <p className="text-muted text-xs p-6 animate-pulse">{t("gen_loading")}</p>;

  return (
    <div className="p-4 md:p-6 max-w-lg pb-24 md:pb-6">
      <h1 className="font-display font-bold text-sm tracking-widest text-text mb-1 glow-cyan">
        &gt; {t("groups_title")}
      </h1>
      <p className="text-muted text-xs mb-5">{t("groups_subtitle")}</p>

      <form onSubmit={createGroup} className="mb-6 cyber-card p-4">
        <label className="block text-[10px] tracking-widest text-cyan mb-2 glow-cyan">
          {t("groups_create_label")}
        </label>
        <div className="flex gap-2">
          <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={t("groups_name_placeholder")} className="field flex-1" />
          <button type="submit" disabled={creating || !newGroupName.trim()}
            className="shrink-0 border border-cyan text-cyan px-3 py-2 rounded text-xs tracking-widest hover:bg-cyan hover:text-bg transition btn-cyber disabled:opacity-40">
            {creating ? "..." : t("groups_create_button")}
          </button>
        </div>
      </form>

      <form onSubmit={joinGroup} className="mb-6 cyber-card p-4">
        <label className="block text-[10px] tracking-widest text-magenta mb-2 glow-magenta">
          {t("groups_join_label")}
        </label>
        <div className="flex gap-2">
          <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
            placeholder={t("groups_code_placeholder")} className="field flex-1 uppercase tracking-widest" maxLength={6} />
          <button type="submit" disabled={joining || !inviteCode.trim()}
            className="shrink-0 border border-magenta text-magenta px-3 py-2 rounded text-xs tracking-widest hover:bg-magenta hover:text-bg transition disabled:opacity-40">
            {joining ? "..." : t("groups_join_button")}
          </button>
        </div>
      </form>

      {error && <p className="text-danger text-xs mb-4">{error}</p>}
      {success && <p className="text-cyan text-xs mb-4 glow-cyan">{success}</p>}

      {loading ? (
        <p className="text-muted text-xs animate-pulse">{t("gen_loading")}</p>
      ) : groups.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-3 opacity-30">🔗</div>
          <p className="text-muted text-xs">{t("groups_empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <Link key={group.chat_id} href={`/groups/${group.chat_id}`}
              className="block border border-border rounded px-4 py-3 hover:border-magenta/30 hover:bg-magenta/5 transition-all hover-lift cyber-card cyber-card-magenta">
              <p className="text-sm text-text font-body">{group.name ?? "Unnamed Group"}</p>
              <p className="text-[10px] text-muted tracking-wider mt-1">
                CODE: {group.invite_code} · {new Date(group.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
