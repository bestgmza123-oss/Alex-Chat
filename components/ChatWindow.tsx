"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { chatMediaPath } from "@/lib/storage-paths";
import MessageCountdown from "./MessageCountdown";
import { useTranslations } from "@/lib/i18n/context";
import type { Message } from "@/lib/types";

// Detect @mentions in text
function parseMentions(text: string): (string | { mention: string })[] {
  const parts: (string | { mention: string })[] = [];
  const regex = /@(\w+)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push({ mention: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// Detect embeddable links (TikTok, YouTube, Instagram)
function parseLinks(text: string): (string | { type: string; url: string; embed: string })[] {
  const parts: (string | { type: string; url: string; embed: string })[] = [];
  const regex = /https?:\/\/[^\s]+/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const url = match[0];
    let type = "link";
    let embed = "";

    if (/youtu\.be|youtube\.com/.test(url)) {
      type = "youtube";
      const id = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
      if (id) embed = `https://www.youtube.com/embed/${id}`;
    } else if (/tiktok\.com/.test(url)) {
      type = "tiktok";
      embed = url;
    } else if (/instagram\.com/.test(url)) {
      type = "instagram";
      embed = url;
    } else if (/\.gif$|\.gif\?/i.test(url)) {
      type = "gif";
      embed = url;
    }

    parts.push({ type, url, embed });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// Job assignment detection: [job: description | assignee | deadline]
function parseJob(text: string): {
  isJob: boolean;
  description?: string;
  assignee?: string;
  deadline?: string;
  progress?: number;
} {
  const jobMatch = text.match(/^\[job:\s*(.+?)\s*\]/i);
  if (jobMatch) {
    const parts = jobMatch[1].split("|").map((s) => s.trim());
    return {
      isJob: true,
      description: parts[0],
      assignee: parts[1],
      deadline: parts[2],
      progress: 0,
    };
  }
  // Check for [goal: description | current/target]
  const goalMatch = text.match(/^\[goal:\s*(.+?)\s*\]/i);
  if (goalMatch) {
    return { isJob: true, description: goalMatch[1], progress: 0 };
  }
  return { isJob: false };
}

export default function ChatWindow({
  chatId,
  userId,
  title,
  pinned,
  onPin,
}: {
  chatId: string;
  userId: string;
  title: string;
  pinned?: boolean;
  onPin?: () => void;
}) {
  const supabase = createClient();
  const { t } = useTranslations();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; username: string }[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [jobProgress, setJobProgress] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  // Load chat members for @mention autocomplete
  useEffect(() => {
    async function loadMembers() {
      const { data: memberRows } = await supabase
        .from("chat_members")
        .select("user_id")
        .eq("chat_id", chatId);
      if (!memberRows) return;
      const ids = memberRows.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", ids);
      if (profiles) setMembers(profiles as { id: string; username: string }[]);
    }
    loadMembers();
  }, [chatId, supabase]);

  const loadMessages = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("messages")
      .select("*, sender:profiles(id, username)")
      .eq("chat_id", chatId)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: true });
    setMessages((data as unknown as Message[]) ?? []);
  }, [chatId, supabase]);

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const row = payload.new as Message;
          const { data: sender } = await supabase
            .from("profiles")
            .select("id, username")
            .eq("id", row.sender_id)
            .maybeSingle();
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, sender: sender ?? undefined }]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const oldRow = payload.old as Partial<Message>;
          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => { scrollToBottom(); }, [messages.length]);

  // Resolve signed URLs for media
  useEffect(() => {
    const pending = messages.filter((m) => m.media_url && !mediaUrls[m.media_url]);
    if (pending.length === 0) return;
    (async () => {
      const entries: [string, string][] = [];
      for (const m of pending) {
        const { data } = await supabase.storage
          .from("chat-media")
          .createSignedUrl(m.media_url as string, 600);
        if (data?.signedUrl) entries.push([m.media_url as string, data.signedUrl]);
      }
      if (entries.length > 0) setMediaUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
  }, [messages, mediaUrls, supabase]);

  // Handle @mention input
  function handleInputChange(value: string) {
    setText(value);
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0 && lastAt === value.length - 1) {
      setShowMentions(true);
      setMentionFilter("");
    } else if (lastAt >= 0) {
      const afterAt = value.slice(lastAt + 1);
      if (!/\s/.test(afterAt)) {
        setShowMentions(true);
        setMentionFilter(afterAt.toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }

  function insertMention(username: string) {
    const lastAt = text.lastIndexOf("@");
    const newText = text.slice(0, lastAt) + "@" + username + " ";
    setText(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  async function sendText(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    setShowMentions(false);

    const { error: sendErr } = await supabase.rpc("send_message", { p_chat_id: chatId, p_sender_id: userId, p_type: "text", p_content: body });

    // Create notifications for @mentions
    const mentionRegex = /@(\w+)/g;
    let m;
    while ((m = mentionRegex.exec(body)) !== null) {
      const mentioned = members.find(
        (mem) => mem.username.toLowerCase() === m![1].toLowerCase()
      );
      if (mentioned && mentioned.id !== userId) {
        await supabase.from("notifications").insert({
          user_id: mentioned.id,
          from_user_id: userId,
          type: "mention_chat",
          ref_id: chatId,
        });
      }
    }

    setSending(false);
    if (sendErr) setError(sendErr.message);
  }

  async function sendFile(file: File) {
    setError(null);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      setError(t("chat_image_only"));
      return;
    }
    const path = chatMediaPath(chatId, file.name);
    const { error: uploadErr } = await supabase.storage.from("chat-media").upload(path, file);
    if (uploadErr) { setError(uploadErr.message); return; }
    const { error: sendErr } = await supabase.rpc("send_message", { p_chat_id: chatId, p_sender_id: userId, p_type: isVideo ? "video" : "image", p_media_url: path });
    if (sendErr) setError(sendErr.message);
  }

  const filteredMembers = members.filter(
    (m) =>
      m.username.toLowerCase().includes(mentionFilter) &&
      m.id !== userId
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* ═══ Header ═══ */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-2 bg-panel/40 backdrop-blur">
        <h1 className="font-display font-bold text-sm tracking-widest text-text truncate glow-cyan flex-1">
          &gt; {title}
        </h1>
        {onPin && (
          <button
            onClick={onPin}
            className={`text-xs transition ${pinned ? "text-cyan glow-cyan" : "text-muted hover:text-cyan"}`}
            title={pinned ? t("prod_unpin_chat") : t("prod_pin_chat")}
          >
            📌
          </button>
        )}
      </div>

      {/* ═══ Messages ═══ */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-muted text-xs text-center py-8">{t("chat_empty")}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          const jobInfo = m.content ? parseJob(m.content) : { isJob: false };

          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] md:max-w-[65%] rounded px-3 py-2 border text-sm ${
                  mine
                    ? "border-cyan/30 bg-cyan/5 border-glow-cyan"
                    : "border-magenta/30 bg-magenta/5 border-glow-magenta"
                }`}
              >
                <p className={`text-[10px] mb-1 ${mine ? "text-cyan" : "text-magenta"}`}>
                  {mine
                    ? "[you@alex ~]$"
                    : `[${m.sender?.username ?? "peer"}@alex ~]$`}
                </p>

                {m.type === "text" && m.content && (
                  <div>
                    {/* Job/Goal message */}
                    {jobInfo.isJob ? (
                      <div className="border border-cyan/20 rounded p-2 bg-cyan/5 mt-1">
                        <p className="text-[10px] text-cyan tracking-wider mb-1">📋 JOB</p>
                        <p className="text-xs">{jobInfo.description}</p>
                        {jobInfo.assignee && (
                          <p className="text-[10px] text-muted mt-1">→ @{jobInfo.assignee}</p>
                        )}
                        {jobInfo.deadline && (
                          <p className="text-[10px] text-magenta mt-1">⏱ {jobInfo.deadline}</p>
                        )}
                        {/* Progress bar */}
                        <div className="progress-bar mt-2">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${jobProgress[m.id] ?? 0}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={jobProgress[m.id] ?? 0}
                            onChange={(e) =>
                              setJobProgress((prev) => ({
                                ...prev,
                                [m.id]: Number(e.target.value),
                              }))
                            }
                            className="flex-1 h-1 accent-cyan"
                          />
                          <span className="text-[10px] text-cyan w-8 text-right">
                            {jobProgress[m.id] ?? 0}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Normal text with @mentions + link previews */
                      <div>
                        <p className="whitespace-pre-wrap break-words">
                          {(() => {
                            const linkParts = parseLinks(m.content);
                            return linkParts.map((part, i) => {
                              if (typeof part === "string") {
                                // Parse @mentions within plain text
                                const mentionParts = parseMentions(part);
                                return mentionParts.map((mp, j) => {
                                  if (typeof mp === "string") return <span key={`${i}-${j}`}>{mp}</span>;
                                  return (
                                    <Link
                                      key={`${i}-${j}`}
                                      href={`/profile`}
                                      className="text-cyan font-bold hover:underline"
                                    >
                                      @{mp.mention}
                                    </Link>
                                  );
                                });
                              }
                              // Embed link
                              if (part.type === "youtube" && part.embed) {
                                return (
                                  <iframe
                                    key={i}
                                    src={part.embed}
                                    className="w-full h-40 rounded mt-1 border border-border"
                                    allowFullScreen
                                    title="YouTube embed"
                                  />
                                );
                              }
                              if (part.type === "gif") {
                                return (
                                  <img
                                    key={i}
                                    src={part.embed}
                                    alt="GIF"
                                    className="max-h-48 rounded mt-1"
                                  />
                                );
                              }
                              return (
                                <a
                                  key={i}
                                  href={part.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan underline hover:text-cyan/80 text-xs"
                                >
                                  {part.url.length > 50 ? part.url.slice(0, 50) + "..." : part.url}
                                </a>
                              );
                            });
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {m.type === "image" && m.media_url && mediaUrls[m.media_url] && (
                  <img src={mediaUrls[m.media_url]} alt="" className="rounded max-h-64 mt-1" />
                )}
                {m.type === "video" && m.media_url && mediaUrls[m.media_url] && (
                  <video src={mediaUrls[m.media_url]} controls className="rounded max-h-64 mt-1" />
                )}
              </div>
              <div className="mt-1">
                <MessageCountdown
                  expiresAt={m.expires_at}
                  onExpire={() => setMessages((prev) => prev.filter((x) => x.id !== m.id))}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-danger text-xs px-4 pb-1">{error}</p>}

      {/* ═══ @mention autocomplete ═══ */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="border-t border-border bg-panel/95 backdrop-blur px-4 py-2 max-h-32 overflow-y-auto">
          {filteredMembers.map((m) => (
            <button
              key={m.id}
              onClick={() => insertMention(m.username)}
              className="block w-full text-left px-2 py-1 text-xs text-cyan hover:bg-cyan/10 rounded transition"
            >
              @{m.username}
            </button>
          ))}
        </div>
      )}

      {/* ═══ Input ═══ */}
      <form onSubmit={sendText} className="border-t border-border p-3 flex items-center gap-2 bg-panel/40 backdrop-blur">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.gif,.webp,.png,.jpg,.jpeg,.bmp,.tiff"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) sendFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 border border-border text-muted hover:text-cyan hover:border-cyan rounded px-2.5 py-2 text-xs transition"
          title={t("chat_attach")}
        >
          📎
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={t("chat_placeholder")}
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="shrink-0 border border-cyan text-cyan px-3 py-2 rounded text-xs hover:bg-cyan hover:text-bg transition btn-cyber disabled:opacity-40"
        >
          {t("chat_send")}
        </button>
      </form>
    </div>
  );
}
