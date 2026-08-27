"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/lib/i18n/context";

export default function GroupsPage() {
  const { userId, loading: userLoading } = useUser();
  const { t } = useTranslations();
  const supabase = createClient();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || userLoading) return;
    let cancelled = false;
    async function loadGroups() {
      const { data: memberships } = await supabase.from("chat_members").select("chat_id").eq("user_id", userId);
      if (!memberships || memberships.length === 0) { setGroups([]); setLoading(false); return; }
      const chatIds = memberships.map((m) => m.chat_id);
      const { data: chatRows } = await supabase.from("chats").select("*, groups!inner(*)").in("id", chatIds).eq("is_group", true).order("created_at", { ascending: false });
      if (!chatRows) { setGroups([]); setLoading(false); return; }
      // Get member counts
      const enriched = await Promise.all(chatRows.map(async (row: any) => {
        const { count } = await supabase.from("chat_members").select("*", { count: "exact", head: true }).eq("chat_id", row.id);
        return { ...row, member_count: count ?? 0 };
      }));
      if (!cancelled) { setGroups(enriched); setLoading(false); }
    }
    loadGroups();
    return () => { cancelled = true; };
  }, [userId, userLoading, supabase]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !groupName.trim()) return;
    setCreating(true); setError(null);
    const name = groupName.trim();
    const { data: chatId, error: chatErr } = await supabase.rpc("create_group_with_member", { p_created_by: userId, p_name: name, p_invite_code: name });
    if (chatErr || !chatId) { setCreating(false); setError(chatErr?.message ?? "Failed"); return; }
    // Update groups table with leader_id
    await supabase.from("groups").update({ leader_id: userId }).eq("chat_id", chatId);
    setCreating(false); setSuccess("Group created! Share name: " + name); setGroupName("");
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !joinName.trim()) return;
    setJoining(true); setError(null); setSuccess(null);
    const { data: result, error } = await supabase.rpc("join_group_by_name", { p_group_name: joinName.trim(), p_user_id: userId });
    setJoining(false);
    if (error || result?.error) { setError(result?.error ?? error?.message ?? "Failed"); return; }
    window.location.href = `/groups/${result.chat_id}`;
  }

  if (userLoading) return <p className="text-muted text-xs p-6 animate-pulse">{t("gen_loading")}</p>;

  return (
    <div className="p-4 md:p-6 max-w-lg pb-24 md:pb-6">
      <h1 className="font-display font-bold text-sm tracking-widest text-text mb-1 glow-cyan">&gt; {t("groups_title")}</h1>
      <p className="text-muted text-xs mb-5">Enter group name to join, or create a new one.</p>

      <form onSubmit={createGroup} className="mb-4 cyber-card p-4">
        <label className="block text-[10px] tracking-widest text-cyan mb-2 glow-cyan">CREATE GROUP</label>
        <div className="flex gap-2">
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name (this IS the invite code)" className="field flex-1" />
          <button type="submit" disabled={creating || !groupName.trim()} className="shrink-0 border border-cyan text-cyan px-3 py-2 rounded text-xs tracking-widest hover:bg-cyan hover:text-bg transition btn-cyber disabled:opacity-40">{creating ? "..." : "CREATE"}</button>
        </div>
      </form>

      <form onSubmit={joinGroup} className="mb-4 cyber-card p-4">
        <label className="block text-[10px] tracking-widest text-magenta mb-2 glow-magenta">JOIN GROUP</label>
        <div className="flex gap-2">
          <input value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="Enter group name" className="field flex-1" />
          <button type="submit" disabled={joining || !joinName.trim()} className="shrink-0 border border-magenta text-magenta px-3 py-2 rounded text-xs tracking-widest hover:bg-magenta hover:text-bg transition disabled:opacity-40">{joining ? "..." : "JOIN"}</button>
        </div>
      </form>

      {error && <p className="text-danger text-xs mb-3">{error}</p>}
      {success && <p className="text-cyan text-xs mb-3 glow-cyan">{success}</p>}

      {loading ? <p className="text-muted text-xs animate-pulse">{t("gen_loading")}</p> : groups.length === 0 ? (
        <div className="text-center py-12"><div className="text-3xl mb-3 opacity-30">🔗</div><p className="text-muted text-xs">No groups yet.</p></div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="block border border-border rounded px-4 py-3 hover:border-cyan/30 hover:bg-cyan/5 transition-all hover-lift cyber-card">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text font-body">{g.name}</p>
                <span className="text-[10px] text-cyan">{g.member_count} members</span>
              </div>
              <p className="text-[10px] text-muted tracking-wider mt-1">{new Date(g.created_at).toLocaleDateString()}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
