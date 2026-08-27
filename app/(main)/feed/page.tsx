"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { createClient } from "@/lib/supabase/client";
import { postImagePath } from "@/lib/storage-paths";
import { useTranslations } from "@/lib/i18n/context";
import type { Post } from "@/lib/types";

type PostWithAuthor = Post & {
  author?: { id: string; username: string; avatar_urls?: string[] };
  expires_at?: string | null;
  like_count?: number;
  user_liked?: boolean;
};

export default function FeedPage() {
  const { userId, loading: userLoading } = useUser();
  const { t } = useTranslations();
  const supabase = createClient();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publicUrls, setPublicUrls] = useState<Record<string, string>>({});
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [showComposer, setShowComposer] = useState(false);
  const [postType, setPostType] = useState<"permanent" | "expiring">("permanent");
  const [shareChatId, setShareChatId] = useState<string | null>(null);
  const [myChats, setMyChats] = useState<{ id: string; name?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userLoading) return;
    let cancelled = false;

    async function loadPosts() {
      setLoading(true);
      const { data } = await supabase
        .from("posts")
        .select("*, author:profiles(id, username, avatar_urls)")
        .order("created_at", { ascending: false });

      if (!cancelled && data) {
        // Check likes for current user
        const postsData = data as unknown as PostWithAuthor[];
        if (userId) {
          const postIds = postsData.map((p) => p.id);
          const { data: likes } = await supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", userId)
            .in("post_id", postIds);

          const likedSet = new Set(likes?.map((l) => l.post_id) ?? []);
          // Count likes per post
          const likeCounts: Record<string, number> = {};
          likes?.forEach((l) => { likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1; });
          postsData.forEach((p) => {
            p.user_liked = likedSet.has(p.id);
            p.like_count = likeCounts[p.id] ?? 0;
          });
        }
        setPosts(postsData);
      }
      if (!cancelled) setLoading(false);
    }

    loadPosts();

    const channel = supabase
      .channel("posts-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          if (cancelled) return;
          const row = payload.new as Post;
          const { data: author } = await supabase
            .from("profiles")
            .select("id, username, avatar_urls")
            .eq("id", row.user_id)
            .maybeSingle();
          const enriched = { ...row, author: author ?? undefined } as PostWithAuthor;
          setPosts((prev) =>
            prev.some((p) => p.id === enriched.id) ? prev : [enriched, ...prev]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          if (cancelled) return;
          const old = payload.old as Partial<Post>;
          if (old.id) setPosts((prev) => prev.filter((p) => p.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userLoading, supabase, userId]);

  // Resolve public URLs
  useEffect(() => {
    const nextUrl: Record<string, string> = {};
    const nextAvatar: Record<string, string> = {};

    for (const post of posts) {
      if (post.image_url && !publicUrls[post.image_url]) {
        nextUrl[post.image_url] = supabase.storage
          .from("post-images")
          .getPublicUrl(post.image_url).data.publicUrl;
      }
      if (post.author?.avatar_urls?.[0] && !avatarUrls[post.author.avatar_urls[0]]) {
        nextAvatar[post.author.avatar_urls[0]] = supabase.storage
          .from("avatars")
          .getPublicUrl(post.author.avatar_urls[0]).data.publicUrl;
      }
    }

    if (Object.keys(nextUrl).length > 0) setPublicUrls((prev) => ({ ...prev, ...nextUrl }));
    if (Object.keys(nextAvatar).length > 0) setAvatarUrls((prev) => ({ ...prev, ...nextAvatar }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  async function toggleLike(postId: string) {
    if (!userId) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.user_liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, user_liked: false, like_count: Math.max(0, (p.like_count ?? 1) - 1) }
            : p
        )
      );
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, user_liked: true, like_count: (p.like_count ?? 0) + 1 }
            : p
        )
      );
    }
  }

  async function uploadPost(file?: File) {
    if (!userId) return;
    if (!file && !caption.trim()) return;
    setUploading(true);
    setError(null);

    let imagePath = "";
    if (file) {
      const path = postImagePath(userId, file.name);
      const { error: uploadErr } = await supabase.storage.from("post-images").upload(path, file);
      if (uploadErr) {
        setUploading(false);
        setError(uploadErr.message);
        return;
      }
      imagePath = path;
    }

    const expiresAt = postType === "expiring"
      ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
      : null;

    const { error: postErr } = await supabase.from("posts").insert({
      user_id: userId,
      image_url: imagePath || null,
      caption: caption.trim(),
      expires_at: expiresAt,
    });

    setUploading(false);
    setCaption("");
    setShowComposer(false);
    if (postErr) setError(postErr.message);
  }

  async function deletePost(postId: string, imageUrl: string) {
    if (!userId) return;
    await supabase.from("posts").delete().eq("id", postId);
    if (imageUrl) await supabase.storage.from("post-images").remove([imageUrl]);
  }

  async function shareToChat(post: PostWithAuthor) {
    if (!userId || !shareChatId) return;
    const shareText = post.caption || "Check out this post";
    const shareUrl = post.image_url ? (publicUrls[post.image_url] || "") : "";
    await supabase.from("messages").insert({
      chat_id: shareChatId,
      sender_id: userId,
      type: "text",
      content: shareUrl ? `${shareText}\n${shareUrl}` : shareText,
    });
    setShareChatId(null);
  }

  useEffect(() => {
    if (!userId) return;
    supabase.from("chat_members").select("chat_id").eq("user_id", userId).then(({ data }) => {
      if (!data) return;
      const ids = data.map((m) => m.chat_id);
      supabase.from("chats").select("id, name").in("id", ids).then(({ data: chats }) => {
        if (chats) setMyChats(chats);
      });
    });
  }, [userId, supabase]);

  // Check for expired posts and remove them
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setPosts((prev) =>
        prev.filter((p) => {
          if (!p.expires_at) return true;
          return new Date(p.expires_at).getTime() > now;
        })
      );
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted text-xs glow-cyan animate-pulse">{t("gen_loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-lg pb-24 md:pb-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-sm tracking-widest text-text glow-cyan">
            &gt; {t("feed_title")}
          </h1>
          <p className="text-muted text-xs mt-0.5">{t("feed_subtitle")}</p>
        </div>
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="w-10 h-10 rounded-full border border-cyan flex items-center justify-center text-cyan hover:bg-cyan hover:text-bg transition-all duration-200 btn-cyber animate-pulse-glow"
          title={t("feed_new_post")}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="9" y1="3" x2="9" y2="15" />
            <line x1="3" y1="9" x2="15" y2="9" />
          </svg>
        </button>
      </div>

      {/* ═══ Composer ═══ */}
      {showComposer && (
        <div className="mb-6 cyber-card p-4 animate-in slide-in-from-top">
          <label className="block text-[10px] tracking-widest text-cyan mb-3 glow-cyan">
            {t("feed_new_post")}
          </label>

          {/* Post type toggle */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setPostType("permanent")}
              className={`flex-1 py-2 text-[10px] tracking-widest rounded border transition-all ${
                postType === "permanent"
                  ? "border-cyan text-cyan bg-cyan/10 glow-cyan"
                  : "border-border text-muted hover:border-cyan/30"
              }`}
            >
              ◆ {t("feed_permanent")}
            </button>
            <button
              onClick={() => setPostType("expiring")}
              className={`flex-1 py-2 text-[10px] tracking-widest rounded border transition-all ${
                postType === "expiring"
                  ? "border-magenta text-magenta bg-magenta/10 glow-magenta"
                  : "border-border text-muted hover:border-magenta/30"
              }`}
            >
              ◇ {t("feed_expiring")}
            </button>
          </div>

          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t("feed_caption_placeholder")}
            className="field mb-3"
          />
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPost(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 border border-cyan text-cyan px-3 py-2 rounded text-xs tracking-widest hover:bg-cyan hover:text-bg transition btn-cyber disabled:opacity-40"
            >
              {uploading ? t("feed_uploading") : t("feed_select_image")}
            </button>
            <button
              type="button"
              disabled={uploading || !caption.trim()}
              onClick={() => uploadPost()}
              className="flex-1 border border-magenta text-magenta px-3 py-2 rounded text-xs tracking-widest hover:bg-magenta hover:text-bg transition disabled:opacity-40"
            >
              {uploading ? "..." : t("gen_post")}
            </button>
            <button
              onClick={() => setShowComposer(false)}
              className="px-3 py-2 text-xs text-muted border border-border rounded hover:border-magenta/30 hover:text-magenta transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-danger text-xs mb-4 glow-magenta">{error}</p>}

      {/* ═══ Feed ═══ */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="cyber-card p-4 animate-pulse">
              <div className="h-4 bg-panel-raised rounded w-1/3 mb-3" />
              <div className="h-48 bg-panel-raised rounded mb-3" />
              <div className="h-3 bg-panel-raised rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4 opacity-30">📡</div>
          <p className="text-muted text-xs">{t("feed_empty")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <div key={post.id} className="cyber-card overflow-hidden hover-lift">
              {/* Image */}
              {post.image_url && publicUrls[post.image_url] ? (
                <img
                  src={publicUrls[post.image_url]}
                  alt={post.caption || ""}
                  className="w-full max-h-[500px] object-cover"
                />
              ) : post.image_url ? (
                <div className="w-full h-48 bg-panel flex items-center justify-center text-muted text-xs">
                  {t("gen_loading")}
                </div>
              ) : null}

              {/* Post footer */}
              <div className="px-4 py-3">
                {/* Like + Actions row */}
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={`transition-all duration-200 ${
                      post.user_liked
                        ? "text-magenta scale-110"
                        : "text-muted hover:text-magenta"
                    }`}
                    title={t("feed_likes")}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill={post.user_liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                      <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                    </svg>
                  </button>
                  <span className="text-[10px] text-muted">
                    {post.like_count ?? 0} {t("feed_likes")}
                  </span>

                  <button
                    onClick={() => setShareChatId(shareChatId === post.id ? null : post.id)}
                    className="text-muted hover:text-cyan transition text-[10px]"
                    title="Share to chat"
                  >
                    ↗
                  </button>
                  {post.user_id === userId && (
                    <button
                      onClick={() => deletePost(post.id, post.image_url)}
                      className="ml-auto text-danger/60 text-[10px] tracking-wider hover:text-danger transition"
                    >
                      {t("feed_delete")}
                    </button>
                  )}
                  {shareChatId === post.id && myChats.length > 0 && (
                    <div className="w-full mt-2 flex flex-wrap gap-1">
                      {myChats.map((chat) => (
                        <button key={chat.id} onClick={() => shareToChat({ ...post } as PostWithAuthor)}
                          className="text-[9px] border border-cyan/30 rounded px-2 py-1 text-cyan hover:bg-cyan/10 transition"
                        >
                          {chat.name || "DM"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Author + timestamp */}
                <div className="flex items-center gap-2">
                  {post.author?.avatar_urls?.[0] && avatarUrls[post.author.avatar_urls[0]] ? (
                    <Link href={`/profile/${post.author.id}`}>
                      <img
                        src={avatarUrls[post.author.avatar_urls[0]]}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover border border-border"
                      />
                    </Link>
                  ) : (
                    <Link
                      href={`/profile/${post.author?.id}`}
                      className="w-6 h-6 rounded-full bg-panel-raised border border-border flex items-center justify-center text-[10px] text-muted"
                    >
                      {(post.author?.username ?? "?")[0].toUpperCase()}
                    </Link>
                  )}
                  <Link
                    href={`/profile/${post.author?.id}`}
                    className="text-xs text-cyan hover:text-cyan/80 transition font-body"
                  >
                    {post.author?.username ?? "unknown"}
                  </Link>
                  <span className="text-[10px] text-muted/50">
                    · {new Date(post.created_at).toLocaleDateString()}
                  </span>
                  {post.expires_at && (
                    <span className="ml-auto text-[10px] text-magenta/70 tracking-wider">
                      ◇ {t("feed_expiring")}
                    </span>
                  )}
                </div>

                {/* Caption */}
                {post.caption && (
                  <p className="text-xs text-text mt-2 leading-relaxed">{post.caption}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
