"use client";

import { useTranslations } from "@/lib/i18n/context";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslations();

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "th" : "en")}
      className="px-2 py-1 text-[10px] tracking-widest border border-border rounded hover:border-cyan hover:text-cyan transition font-body"
      title={locale === "en" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English"}
    >
      {locale === "en" ? "TH" : "EN"}
    </button>
  );
}
