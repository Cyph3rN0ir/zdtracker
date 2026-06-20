import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "bn";

const DICT: Record<string, { en: string; bn: string }> = {
  // Brand & nav
  "brand": { en: "ZeroSync", bn: "জিরোসিঙ্ক" },
  "nav.dashboard": { en: "Dashboard", bn: "ড্যাশবোর্ড" },
  "nav.myTasks": { en: "My tasks", bn: "আমার কাজ" },
  "nav.personal": { en: "Personal", bn: "ব্যক্তিগত" },
  "nav.users": { en: "Users", bn: "ব্যবহারকারী" },
  "nav.businesses": { en: "Businesses", bn: "ব্যবসা" },
  "nav.signOut": { en: "Sign out", bn: "সাইন আউট" },
  "nav.menu": { en: "Navigation", bn: "নেভিগেশন" },

  // Common
  "common.save": { en: "Save", bn: "সংরক্ষণ" },
  "common.saveChanges": { en: "Save changes", bn: "পরিবর্তন সংরক্ষণ" },
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
  "common.total": { en: "Total", bn: "মোট" },
  "common.unknown": { en: "unknown", bn: "অজানা" },
  "common.none": { en: "None.", bn: "কিছু নেই।" },
  "common.created": { en: "Created", bn: "তৈরি" },
  "common.tip": { en: "Tip", bn: "পরামর্শ" },

  // Roles
  "role.admin": { en: "Admin", bn: "অ্যাডমিন" },
  "role.owner": { en: "Owner", bn: "মালিক" },
  "role.investor": { en: "Investor", bn: "বিনিয়োগকারী" },
  "role.member": { en: "Member", bn: "সদস্য" },

  // Auth
  "auth.signIn": { en: "Sign in", bn: "সাইন ইন" },
  "auth.signingIn": { en: "Signing in…", bn: "সাইন ইন করা হচ্ছে…" },
  "auth.signUp": { en: "Sign up", bn: "সাইন আপ" },
  "auth.username": { en: "Username", bn: "ইউজারনেম" },
  "auth.password": { en: "Password", bn: "পাসওয়ার্ড" },
  "auth.displayName": { en: "Display name", bn: "প্রদর্শিত নাম" },
  "auth.subtitle": { en: "Accounts are created by the administrator.", bn: "অ্যাকাউন্ট অ্যাডমিনিস্ট্রেটর তৈরি করেন।" },
  "auth.failed": { en: "Sign in failed", bn: "সাইন ইন ব্যর্থ হয়েছে" },
  "auth.titleHead": { en: "Sign in — ZeroSync", bn: "সাইন ইন — জিরোসিঙ্ক" },

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

  // Money
  "money.record": { en: "Record transaction", bn: "লেনদেন রেকর্ড করুন" },
  "money.recordDesc": { en: "Log an investment, earning, or expense.", bn: "বিনিয়োগ, আয় বা ব্যয় লিপিবদ্ধ করুন।" },
  "money.kind": { en: "Kind", bn: "ধরন" },
  "money.party": { en: "Party", bn: "পক্ষ" },
  "money.addTx": { en: "Add transaction", bn: "লেনদেন যোগ করুন" },
  "money.kind.investment": { en: "Investment", bn: "বিনিয়োগ" },
  "money.kind.earning": { en: "Earning", bn: "আয়" },
  "money.kind.expense": { en: "Expense", bn: "ব্যয়" },
  "money.section.investment": { en: "Investments", bn: "বিনিয়োগসমূহ" },
  "money.section.earning": { en: "Earnings", bn: "আয়সমূহ" },
  "money.section.expense": { en: "Expenses", bn: "ব্যয়সমূহ" },
  "money.tipAddPeople": { en: "Tip: add people first so you can attribute transactions.", bn: "পরামর্শ: লেনদেন বরাদ্দ করতে প্রথমে সদস্য যোগ করুন।" },
  "money.addPeople": { en: "Add people", bn: "সদস্য যোগ করুন" },
  // Money validation/toasts
  "money.err.amount": { en: "Enter a valid amount", bn: "একটি বৈধ পরিমাণ দিন" },
  "money.err.positive": { en: "Amount must be greater than 0", bn: "পরিমাণ অবশ্যই ০ এর বেশি হতে হবে" },
  "money.err.party": { en: "Pick a party for this transaction", bn: "এই লেনদেনের জন্য একটি পক্ষ নির্বাচন করুন" },
  "money.err.date": { en: "Pick a valid date", bn: "একটি বৈধ তারিখ নির্বাচন করুন" },
  "money.toast.added": { en: "Transaction recorded", bn: "লেনদেন রেকর্ড হয়েছে" },
  "money.toast.failed": { en: "Failed to record transaction", bn: "লেনদেন রেকর্ড করতে ব্যর্থ" },
  "money.toast.deleted": { en: "Transaction deleted", bn: "লেনদেন মুছে ফেলা হয়েছে" },
  "money.toast.deleteFailed": { en: "Failed to delete", bn: "মুছতে ব্যর্থ" },

  // Tasks calendar
  "tasks.prevWeek": { en: "Previous week", bn: "আগের সপ্তাহ" },
  "tasks.nextWeek": { en: "Next week", bn: "পরের সপ্তাহ" },
  "tasks.thisWeek": { en: "This week", bn: "এই সপ্তাহ" },
  "tasks.noneScheduled": { en: "No tasks scheduled", bn: "কোনো কাজ নির্ধারিত নেই" },
  "tasks.summary": { en: "{done} of {total} done", bn: "{total} এর মধ্যে {done} সম্পন্ন" },
  "tasks.addTask": { en: "Add task", bn: "কাজ যোগ করুন" },
  "tasks.newTask": { en: "New task", bn: "নতুন কাজ" },
  "tasks.createTask": { en: "Create task", bn: "কাজ তৈরি করুন" },
  "tasks.title": { en: "Title", bn: "শিরোনাম" },
  "tasks.details": { en: "Details", bn: "বিস্তারিত" },
  "tasks.assignee": { en: "Assignee", bn: "দায়িত্বপ্রাপ্ত" },
  "tasks.chooseAssignee": { en: "Choose…", bn: "নির্বাচন করুন…" },
  "tasks.markDone": { en: "Mark done", bn: "সম্পন্ন চিহ্নিত করুন" },
  "tasks.markPending": { en: "Mark pending", bn: "চলমান হিসেবে চিহ্নিত করুন" },
  "tasks.empty.noAssignees.title": { en: "No assignees yet", bn: "এখনো কোনো দায়িত্বপ্রাপ্ত নেই" },
  "tasks.empty.noAssignees.msg": { en: "Add people to this business before scheduling tasks.", bn: "কাজ নির্ধারণের আগে এই ব্যবসায় সদস্য যোগ করুন।" },
  "tasks.empty.noTasks.title": { en: "No tasks for this day", bn: "এই দিনের জন্য কোনো কাজ নেই" },
  "tasks.empty.noTasks.msg": { en: "Plan work for your team — assign a task with a quick title and details.", bn: "আপনার দলের জন্য কাজ পরিকল্পনা করুন — শিরোনাম ও বিবরণ দিয়ে কাজ বরাদ্দ করুন।" },
  "tasks.empty.addOne": { en: "Add a task", bn: "একটি কাজ যোগ করুন" },
  "tasks.weekSummary": { en: "Week summary", bn: "সাপ্তাহিক সারসংক্ষেপ" },
  "tasks.weekSummaryDesc": { en: "Completion by assignee", bn: "দায়িত্বপ্রাপ্ত অনুযায়ী সম্পন্নতা" },
  "tasks.err.title": { en: "Title is required", bn: "শিরোনাম আবশ্যক" },
  "tasks.err.titleLong": { en: "Title is too long", bn: "শিরোনাম অনেক বড়" },
  "tasks.err.assignee": { en: "Choose an assignee", bn: "একজন দায়িত্বপ্রাপ্ত নির্বাচন করুন" },
  "tasks.toast.created": { en: "Task created", bn: "কাজ তৈরি হয়েছে" },
  "tasks.toast.createFailed": { en: "Failed to create task", bn: "কাজ তৈরি করতে ব্যর্থ" },
  "tasks.toast.updateFailed": { en: "Failed to update task", bn: "কাজ আপডেট করতে ব্যর্থ" },
  "tasks.toast.deleted": { en: "Task deleted", bn: "কাজ মুছে ফেলা হয়েছে" },

  // Admin users
  "users.title": { en: "Users", bn: "ব্যবহারকারীগণ" },
  "users.subtitle": { en: "Create accounts, edit credentials, set roles.", bn: "অ্যাকাউন্ট তৈরি, পরিচয়পত্র সম্পাদনা ও ভূমিকা নির্ধারণ করুন।" },
  "users.new": { en: "New user", bn: "নতুন ব্যবহারকারী" },
  "users.newDesc": { en: "Set a username, password, and role.", bn: "একটি ইউজারনেম, পাসওয়ার্ড ও ভূমিকা নির্ধারণ করুন।" },
  "users.create": { en: "Create user", bn: "ব্যবহারকারী তৈরি" },
  "users.all": { en: "All users", bn: "সকল ব্যবহারকারী" },
  "users.totalCount": { en: "{n} total", bn: "মোট {n} জন" },
  "users.editTitle": { en: "Edit user", bn: "ব্যবহারকারী সম্পাদনা" },
  "users.editDesc": { en: "Update username, password, display name or role.", bn: "ইউজারনেম, পাসওয়ার্ড, প্রদর্শিত নাম বা ভূমিকা পরিবর্তন করুন।" },
  "users.newPassword": { en: "New password", bn: "নতুন পাসওয়ার্ড" },
  "users.passwordKeep": { en: "Leave blank to keep current", bn: "অপরিবর্তিত রাখতে খালি রাখুন" },
  "users.confirmDelete": { en: "Delete {name}?", bn: "{name} মুছবেন?" },
  "users.empty": { en: "No users yet.", bn: "এখনো কোনো ব্যবহারকারী নেই।" },
  "users.toast.created": { en: "User created", bn: "ব্যবহারকারী তৈরি হয়েছে" },
  "users.toast.updated": { en: "User updated", bn: "ব্যবহারকারী আপডেট হয়েছে" },
  "users.toast.deleted": { en: "User deleted", bn: "ব্যবহারকারী মুছে ফেলা হয়েছে" },
  "users.toast.failed": { en: "Failed", bn: "ব্যর্থ" },
  "users.toast.deleteFailed": { en: "Failed to delete", bn: "মুছতে ব্যর্থ" },
  "users.err.uReq": { en: "Username is required", bn: "ইউজারনেম আবশ্যক" },
  "users.err.uMin": { en: "At least 2 characters", bn: "কমপক্ষে ২ অক্ষর" },
  "users.err.uMax": { en: "Max 64 characters", bn: "সর্বোচ্চ ৬৪ অক্ষর" },
  "users.err.uChars": { en: "Letters, numbers, . _ - only", bn: "শুধু অক্ষর, সংখ্যা, . _ - অনুমোদিত" },
  "users.err.pMin": { en: "Password must be at least 4 characters", bn: "পাসওয়ার্ড কমপক্ষে ৪ অক্ষর হতে হবে" },
  "users.err.pMax": { en: "Password too long", bn: "পাসওয়ার্ড অনেক বড়" },
};

export function roleLabel(role: string, t: (k: string, f?: string) => string) {
  const k = `role.${(role || "").toLowerCase()}`;
  return t(k, role);
}

type TFn = (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
};

const I18nContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "zt.lang";

function format(s: string, params?: Record<string, string | number>) {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

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
    if (typeof window !== "undefined") {
      (async () => {
        const mod = await import("./auto-translate");
        if (lang === "bn") mod.enableAutoTranslate();
        else mod.disableAutoTranslate();
      })();
    }
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
    if (typeof window !== "undefined" && l === "en") {
      // Easiest way to fully revert DOM to English.
      window.location.reload();
    }
  }

  function t(key: string, fallbackOrParams?: string | Record<string, string | number>, maybeParams?: Record<string, string | number>) {
    const fallback = typeof fallbackOrParams === "string" ? fallbackOrParams : undefined;
    const params = typeof fallbackOrParams === "object" ? fallbackOrParams : maybeParams;
    const entry = DICT[key];
    const raw = entry ? (entry[lang] ?? entry.en) : (fallback ?? key);
    return format(raw, params);
  }

  return <I18nContext.Provider value={{ lang, setLang, t: t as any }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) return { lang: "en" as Lang, setLang: () => {}, t: ((k: string, f?: any) => (typeof f === "string" ? f : k)) as TFn };
  return ctx;
}
