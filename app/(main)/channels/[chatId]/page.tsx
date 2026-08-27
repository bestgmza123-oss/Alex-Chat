"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import ChatWindow from "@/components/ChatWindow";

export default function ChannelDetailPage({
  params,
}: {
  params: { chatId: string };
}) {
  const { userId, loading } = useUser();
  const [title, setTitle] = useState("CHANNEL");

  useEffect(() => {
    if (!userId || loading) return;
    let cancelled = false;

    async function loadTitle() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: members } = await supabase
        .from("chat_members")
        .select("user_id")
        .eq("chat_id", params.chatId)
        .neq("user_id", userId);

      const otherId = members?.[0]?.user_id;
      if (otherId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", otherId)
          .maybeSingle();
        if (!cancelled && prof) setTitle(prof.username.toUpperCase());
      }
    }
    loadTitle();
    return () => { cancelled = true; };
  }, [userId, loading, params.chatId]);

  if (loading || !userId) {
    return <p className="text-muted text-xs p-6">LOADING...</p>;
  }

  return (
    <ChatWindow chatId={params.chatId} userId={userId} title={title} />
  );
}
