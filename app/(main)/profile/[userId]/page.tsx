"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/lib/i18n/context";
import Link from "next/link";

type UserProfile = {
  id: string;
  username: string;
  bio: string;
  avatar_urls: string[];
  created_at: string;
};

type UserPost = {
  id: string;
  image_url: string;
  caption: string;
  created_at: string;
};

export default function PublicProfilePage({
  params,
}: {
  params: { userId: string };
}) {
  const { t } = useTranslations();
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [postUrls, setPostUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", params.userId)
        .maybeSingle();

      if (prof) {
        setProfile(prof as UserProfile);
        if (prof.avatar_urls?.[0]) {
          setAvatarUrl(
            supabase.storage.from("avatars").getPublicUrl(prof.avatar_urls[0]).data.publicUrl
          );
        }
      }

      const { data: postData } = await supabase
        .from("posts")
        .select("id, image_url, caption, created_at")
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false });

      if (postData) setPosts(postData);
      setLoading(false);
    }
    load();
  }, [params.userId, supabase]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of posts) {
      if (p.image_url && !postUrls[p.image_url]) {
        next[p.image_url] = supabase.storage
          .from("post-images")
          .getPublicUrl(p.image_url).data.publicUrl;
      }
    }
    if (Object.keys(next).length > 0) setPostUrls((prev) => ({ ...prev, ...next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted text-xs animate-pulse glow-cyan">{t("gen_loading")}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted text-xs">{t("channels_not_found")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-lg pb-24 md:pb-6">
      {/* Profile Header */}
      <div className="cyber-card p-6 mb-6 text-center">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-24 h-24 rounded-full object-cover border-2 border-cyan/30 mx-auto mb-4 animate-pulse-glow"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-panel-raised border-2 border-cyan/20 mx-auto mb-4 flex items-center justify-center text-2xl text-muted">
            {profile.username[0].toUpperCase()}
          </div>
        )}
        <h1 className="font-display font-bold text-lg text-text glow-cyan">
          {profile.username}
        </h1>
        {profile.bio && (
          <p className="text-xs text-muted mt-2 max-w-xs mx-auto">{profile.bio}</p>
        )}
        <p className="text-[10px] text-muted/40 mt-3">
          joined {new Date(profile.created_at).toLocaleDateString()}
        </p>
        <div className="flex justify-center gap-3 mt-4">
          <Link
            href={`/channels`}
            className="text-[10px] tracking-widest text-cyan border border-cyan/30 px-3 py-1.5 rounded hover:bg-cyan hover:text-bg transition btn-cyber"
          >
            {t("channels_connect")}
          </Link>
        </div>
      </div>

      {/* User's Posts */}
      <h2 className="font-display font-bold text-xs tracking-widest text-muted mb-4">
        &gt; POSTS ({posts.length})
      </h2>
      {posts.length === 0 ? (
        <p className="text-muted text-xs text-center py-8">{t("feed_empty")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {posts.map((post) => (
            <div key={post.id} className="aspect-square relative group overflow-hidden rounded">
              {postUrls[post.image_url] ? (
                <img
                  src={postUrls[post.image_url]}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-panel-raised" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-white text-xs">{post.caption || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
