import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "bn";

const DICT: Record<string, { en: string; bn: string }> = {
  // Brand & nav
  "brand": { en: "ZeroTrack", bn: "জিরোট্র্যাক" },
  "nav.dashboard": { en: "Dashboard", bn: "ড্যাশবোর্ড" },
  "nav.myTasks": { en: "My tasks", bn: "আমার কাজ" },
  "nav.personal": { en: "Personal", bn: "ব্যক্তিগত" },
  "nav.users": { en: "Users", bn: "ব্যবহারকারী" },
  "nav.businesses": { en: "Businesses", bn: "ব্যবসা" },
  "nav.signOut": { en: "Sign out", bn: "সাইন আউট" },
  "nav.menu": { en: "Navigation", bn: "নেভিগেশন" },

  // Common
  "common.save": { en: "Save", bn: "সংরক্ষণ" },
  "common.cancel": { en: "Cancel", bn: "বাতিল" },
  "common.delete": { en: "Delete", bn: "মুছুন" },
  "common.edit": { en: "Edit", bn: "সম্পাদনা" },
  "common.add": { en: "Add", bn: "যোগ করুন" },
  "common.create": { en: "Create", bn: "তৈরি করুন" },
  "common.update": { en: "Update", bn: "আপডেট" },
  "common.search": { en: "Search", bn: "অনুসন্ধান" },
  "common.loading": { en: "Loading…", bn: "লোড হচ্ছে…" },
  "common.empty": { en: "Nothing here yet", bn: "এখনও কিছু নেই" },
  "common.actions": { en: "Actions", bn: "ক্রিয়া" },
  "common.name": { en: "Name", bn: "নাম" },
  "common.role": { en: "Role", bn: "ভূমিকা" },
  "common.amount": { en: "Amount", bn: "পরিমাণ" },
  "common.date": { en: "Date", bn: "তারিখ" },
  "common.note": { en: "Note", bn: "নোট" },
  "common.status": { en: "Status", bn: "স্ট্যাটাস" },
  "common.done": { en: "Done", bn: "সম্পন্ন" },
  "common.pending": { en: "Pending", bn: "চলমান" },
  "common.today": { en: "Today", bn: "আজ" },
  "common.yesterday": { en: "Yesterday", bn: "গতকাল" },
  "common.tomorrow": { en: "Tomorrow", bn: "আগামীকাল" },
  "common.language": { en: "Language", bn: "ভাষা" },

  // Auth
  "auth.signIn": { en: "Sign in", bn: "সাইন ইন" },
  "auth.signUp": { en: "Sign up", bn: "সাইন আপ" },
  "auth.username": { en: "Username", bn: "ইউজারনেম" },
  "auth.password": { en: "Password", bn: "পাসওয়ার্ড" },
  "auth.displayName": { en: "Display name", bn: "প্রদর্শিত নাম" },

  // Business tabs
  "biz.overview": { en: "Overview", bn: "সারসংক্ষেপ" },
  "biz.people": { en: "People", bn: "সদস্যরা" },
  "biz.money": { en: "Money", bn: "অর্থ" },
  "biz.tasks": { en: "Tasks", bn: "কাজ" },
  "biz.profit": { en: "Profit", bn: "মুনাফা" },
  "biz.owners": { en: "Owners", bn: "মালিক" },
  "biz.investors": { en: "Investors", bn: "বিনিয়োগকারী" },
  "biz.workers": { en: "Workers", bn: "কর্মী" },
  "biz.income": { en: "Income", bn: "আয়" },
  "biz.expense": { en: "Expense", bn: "ব্যয়" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "zt.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "en" || saved === "bn") setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dataset.lang = lang;
    }
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }

  function t(key: string, fallback?: string) {
    const entry = DICT[key];
    if (!entry) return fallback ?? key;
    return entry[lang] ?? entry.en;
  }

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) return { lang: "en" as Lang, setLang: () => {}, t: (_k: string, f?: string) => f ?? _k };
  return ctx;
}
