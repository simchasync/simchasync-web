import React, { createContext, useContext, useState, useEffect } from "react";
import { en } from "@/i18n/en";
import { he } from "@/i18n/he";
import { yi } from "@/i18n/yi";

type Language = "en" | "he" | "yi";
type Translations = typeof en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Translations> = { en, he, yi };

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("simchasync-lang") as Language) || "en"
  );

  useEffect(() => {
    localStorage.setItem("simchasync-lang", language);
    document.documentElement.dir = language === "en" ? "ltr" : "rtl";
    document.documentElement.lang = language;
  }, [language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
    dir: language === "en" ? "ltr" : "rtl",
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
