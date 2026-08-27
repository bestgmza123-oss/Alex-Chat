"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { useTranslations } from "@/lib/i18n/context";
import { avatarPath } from "@/lib/storage-paths";
import { createClient } from "@/lib/supabase/client";

const MAX_AVATARS = 3;

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function ProfilePage() {
  const router = useRouter();
  const { userId, profile, loading, supabase } = useUser();
  const { t } = useTranslations();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrls, setAvatarUrls] = useState<string[]>([]);
  const [publicUrls, setPublicUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setBio(profile.bio ?? "");
    setAvatarUrls(profile.avatar_urls ?? []);
  }, [profile]);

  useEffect(() => {
    if (!userId) return;
    // Load or generate access code
    async function loadCode() {
      const { data } = await supabase
        .from("profiles")
        .select("access_code")
        .eq("id", userId)
        .maybeSingle();

      if (data?.access_code) {
        setAccessCode(data.access_code);
      } else {
        const newCode = generateCode();
        await supabase
          .from("profiles")
          .update({ access_code: newCode })
          .eq("id", userId);
        setAccessCode(newCode);
      }
    }
    loadCode();
  }, [userId, supabase]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const path of avatarUrls) {
      if (!publicUrls[path]) {
        next[path] = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
    }
    if (Object.keys(next).length > 0) setPublicUrls((prev) => ({ ...prev, ...next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarUrls]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const cleanUsername = username.trim().toLowerCase();
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ username: cleanUsername, bio: bio.trim() })
      .eq("id", userId);

    setSaving(false);
    if (updateErr) {
      setError(
        updateErr.message.includes("duplicate") ? "that username is taken." : updateErr.message
      );
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function uploadAvatar(file: File) {
    if (!userId) return;
    if (avatarUrls.length >= MAX_AVATARS) {
      setError(`maximum ${MAX_AVATARS} profile pictures.`);
      return;
    }
    setError(null);
    setUploading(true);
    const path = avatarPath(userId, file.name);
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file);
    if (uploadErr) { setUploading(false); setError(uploadErr.message); return; }
    const nextUrls = [...avatarUrls, path];
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_urls: nextUrls })
      .eq("id", userId);
    setUploading(false);
    if (updateErr) { await supabase.storage.from("avatars").remove([path]); setError(updateErr.message); return; }
    setAvatarUrls(nextUrls);
  }

  async function removeAvatar(path: string) {
    if (!userId) return;
    setError(null);
    const nextUrls = avatarUrls.filter((u) => u !== path);
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_urls: nextUrls })
      .eq("id", userId);
    if (updateErr) { setError(updateErr.message); return; }
    await supabase.storage.from("avatars").remove([path]);
    setAvatarUrls(nextUrls);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function copyCode() {
    navigator.clipboard.writeText(accessCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  if (loading || !profile) return <p className="text-muted text-xs p-6 animate-pulse">{t("gen_loading")}</p>;

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto pb-24 md:pb-6">
      <h1 className="font-display font-bold text-sm tracking-widest text-text mb-1 glow-cyan">
        &gt; {t("profile_title")}
      </h1>
      <p className="text-muted text-xs mb-5">{t("profile_subtitle")}</p>

      {/* ═══ Access Code ═══ */}
      <div className="cyber-card p-4 mb-6 border-glow-cyan animate-pulse-glow">
        <label className="block text-[10px] tracking-widest text-cyan mb-2 glow-cyan">
          {t("profile_code_label")}
        </label>
        <p className="text-[10px] text-muted mb-3">{t("profile_code_description")}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-bg/50 border border-cyan/20 rounded px-3 py-2 font-display text-lg tracking-[0.3em] text-cyan text-center glow-cyan-strong">
            {accessCode || "------"}
          </div>
          <button
            onClick={copyCode}
            className="shrink-0 border border-cyan text-cyan px-3 py-2 rounded text-xs tracking-widest hover:bg-cyan hover:text-bg transition btn-cyber"
          >
            {codeCopied ? "✓" : "COPY"}
          </button>
        </div>
      </div>

      {/* ═══ Profile Pictures ═══ */}
      <div className="mb-6">
        <label className="block text-[10px] tracking-widest text-muted mb-2">
          {t("profile_pictures")} ({avatarUrls.length}/{MAX_AVATARS})
        </label>
        <div className="flex gap-2 flex-wrap">
          {avatarUrls.map((path) => (
            <div key={path} className="relative w-20 h-20 group">
              {publicUrls[path] && (
                <img
                  src={publicUrls[path]}
                  alt=""
                  className="w-20 h-20 rounded object-cover border border-border group-hover:border-cyan/40 transition"
                />
              )}
              <button
                onClick={() => removeAvatar(path)}
                className="absolute -top-1.5 -right-1.5 bg-panel border border-danger text-danger text-[10px] w-5 h-5 rounded-full leading-none opacity-0 group-hover:opacity-100 transition"
                title="remove"
              >
                ×
              </button>
            </div>
          ))}
          {avatarUrls.length < MAX_AVATARS && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 border border-dashed border-border hover:border-cyan text-muted hover:text-cyan rounded text-xs flex items-center justify-center disabled:opacity-40 transition"
              >
                {uploading ? "..." : t("profile_add")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══ Profile Form ═══ */}
      <form onSubmit={saveProfile} className="space-y-3">
        <div>
          <label className="block text-[10px] tracking-widest text-muted mb-1">{t("profile_username")}</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="field" />
        </div>
        <div>
          <label className="block text-[10px] tracking-widest text-muted mb-1">{t("profile_bio")}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="field"
            rows={3}
            maxLength={200}
          />
        </div>

        {error && <p className="text-danger text-xs">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 border border-cyan text-cyan px-3 py-2 rounded text-xs tracking-widest hover:bg-cyan hover:text-bg transition btn-cyber disabled:opacity-40"
          >
            {saving ? t("profile_saving") : saved ? t("profile_saved") : t("profile_save")}
          </button>
          <button
            type="button"
            onClick={logout}
            className="border border-danger/40 text-danger/70 px-3 py-2 rounded text-xs tracking-widest hover:bg-danger hover:text-bg transition"
          >
            {t("profile_logout")}
          </button>
        </div>
      </form>
    </div>
  );
}
