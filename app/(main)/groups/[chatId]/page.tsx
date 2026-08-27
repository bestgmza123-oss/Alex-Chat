"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import ChatWindow from "@/components/ChatWindow";

export default function GroupChatPage({
  params,
}: {
  params: { chatId: string };
}) {
  const { userId, loading } = useUser();
  const [title, setTitle] = useState("GROUP");

  useEffect(() => {
    if (!userId || loading) return;
    let cancelled = false;

    async function loadTitle() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: chat } = await supabase
        .from("chats")
        .select("name")
        .eq("id", params.chatId)
        .maybeSingle();
      if (!cancelled && chat?.name) setTitle(chat.name.toUpperCase());
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
