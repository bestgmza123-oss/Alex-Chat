"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  labelKey: "nav_chats" | "nav_channels" | "nav_groups" | "nav_feed" | "nav_ident";
  icon: (p: { active?: boolean }) => JSX.Element;
};

const ITEMS: NavItem[] = [
  { href: "/chats", labelKey: "nav_chats", icon: ChatIcon },
  { href: "/channels", labelKey: "nav_channels", icon: NodeIcon },
  { href: "/groups", labelKey: "nav_groups", icon: GroupIcon },
  { href: "/feed", labelKey: "nav_feed", icon: FeedIcon },
  { href: "/profile", labelKey: "nav_ident", icon: IdentIcon },
];

export default function NavBar() {
  const pathname = usePathname();
  const { t } = useTranslations();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    async function loadNotifs() {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.user.id)
        .eq("read", false);
      setNotifCount(count ?? 0);
    }
    loadNotifs();
    // Poll every 30s
    const iv = setInterval(loadNotifs, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      {/* ═══ Desktop Sidebar ═══ */}
      <nav className="hidden md:flex md:flex-col md:w-56 md:shrink-0 border-r border-border bg-panel/60 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
          <Logo size={28} />
          <span className="font-display font-bold text-sm tracking-widest text-text glow-cyan">
            ALEX<span className="text-cyan">-</span>CHAT
          </span>
        </div>
        <div className="flex-1 py-3">
          {ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-xs tracking-widest border-l-2 transition-all duration-200 ${
                  active
                    ? "border-cyan text-cyan bg-cyan/5 glow-cyan"
                    : "border-transparent text-muted hover:text-text hover:bg-panel-raised/30 hover:border-cyan/30"
                }`}
              >
                <Icon active={active} />
                {t(item.labelKey)}
                {item.href === "/feed" && notifCount > 0 && (
                  <span className="ml-auto notif-badge">{notifCount}</span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-muted tracking-wider">
              {t("gen_session_idle")} · 5:00
            </span>
            <LanguageSwitcher />
          </div>
          <p className="text-[9px] text-muted/50 tracking-wider">
            {t("gen_developed_by")}
          </p>
        </div>
      </nav>

      {/* ═══ Mobile Bottom Nav ═══ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 flex border-t border-border bg-panel/90 backdrop-blur safe-area-bottom">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] tracking-wider border-t-2 transition-all duration-200 ${
                active
                  ? "border-cyan text-cyan glow-cyan"
                  : "border-transparent text-muted"
              }`}
            >
              <span className="relative">
                <Icon active={active} />
                {item.href === "/feed" && notifCount > 0 && (
                  <span className="notif-badge">{notifCount}</span>
                )}
              </span>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/* ═══ SVG Icons — straight-line terminal aesthetic ═══ */


function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 3h12v8H4l-2 2V3z" />
    </svg>
  );
}
function NodeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
      {active && <circle cx="4.5" cy="4.5" r="1" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="5" cy="5" r="2.2" />
      <circle cx="11" cy="5" r="2.2" />
      <path d="M2 14c0-2.5 1.8-4 3-4s3 1.5 3 4M8 14c0-2.5 1.8-4 3-4s3 1.5 3 4" />
    </svg>
  );
}

function FeedIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <circle cx="8" cy="8" r="3" />
      {active && <circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function IdentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    </svg>
  );
}
