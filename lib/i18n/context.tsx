"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import translations, { type Locale, type TranslationKeys } from "./translations";

type I18nContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof TranslationKeys) => string;
};

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("alex-chat-lang") as Locale | null;
    if (saved && (saved === "en" || saved === "th")) {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("alex-chat-lang", l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: keyof TranslationKeys): string => {
      return translations[locale]?.[key] ?? translations.en[key] ?? key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslations() {
  return useContext(I18nContext);
}
