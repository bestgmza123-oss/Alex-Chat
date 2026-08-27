"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { createClient } from "@/lib/supabase/client";

export default function ChatsPage() {
  const { userId, loading: userLoading } = useUser();
  const supabase = createClient();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || userLoading) return;
    let cancelled = false;
    async function load() {
      const { data: memberships } = await supabase.from("chat_members").select("chat_id").eq("user_id", userId);
      if (!memberships || memberships.length === 0) { setChats([]); setLoading(false); return; }
      const chatIds = memberships.map((m) => m.chat_id);
      const { data: chatRows } = await supabase.from("chats").select("*").in("id", chatIds).order("created_at", { ascending: false });
      if (!chatRows) { setChats([]); setLoading(false); return; }
      const enriched = await Promise.all(chatRows.map(async (chat: any) => {
        let title = chat.name || "Direct Message";
        let subtitle = "";
        if (!chat.is_group) {
          const { data: members } = await supabase.from("chat_members").select("user_id").eq("chat_id", chat.id).neq("user_id", userId);
          const otherId = members?.[0]?.user_id;
          if (otherId) {
            const { data: prof } = await supabase.from("profiles").select("username").eq("id", otherId).maybeSingle();
            title = prof?.username ?? "Unknown";
          }
        } else {
          const { count } = await supabase.from("chat_members").select("*", { count: "exact", head: true }).eq("chat_id", chat.id);
          subtitle = `${count ?? 0} members`;
        }
        const { data: lastMsg } = await supabase.from("messages").select("content, created_at").eq("chat_id", chat.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        return { ...chat, title, subtitle, lastMsg };
      }));
      if (!cancelled) { setChats(enriched); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, userLoading, supabase]);

  if (userLoading) return <p className="text-muted text-xs p-6">Loading...</p>;
  return (
    <div className="p-4 md:p-6 max-w-lg pb-24 md:pb-6">
      <h1 className="font-display font-bold text-sm tracking-widest text-text mb-1 glow-cyan">&gt; CHATS</h1>
      <p className="text-muted text-xs mb-5">Your conversations.</p>
      {loading ? <p className="text-muted text-xs animate-pulse">Loading...</p> : chats.length === 0 ? (
        <div className="text-center py-12"><p className="text-muted text-xs">No conversations yet.</p></div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Link key={chat.id} href={`/${chat.is_group ? "groups" : "channels"}/${chat.id}`} className="block border border-border rounded px-4 py-3 hover:border-cyan/30 hover:bg-cyan/5 transition-all hover-lift cyber-card">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text font-body">{chat.title}</p>
                {chat.subtitle && <span className="text-[10px] text-muted">{chat.subtitle}</span>}
              </div>
              {chat.lastMsg && <p className="text-[10px] text-muted mt-1 truncate">{chat.lastMsg.content?.slice(0, 60) || "..."}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
