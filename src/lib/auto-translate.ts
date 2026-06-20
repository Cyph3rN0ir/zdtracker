// Runtime EN -> BN translator. When lang=bn, walks DOM text nodes and a
// handful of attributes (placeholder, title, aria-label) and replaces any
// exact-match English string from the dictionary below. New nodes added later
// are caught by a MutationObserver.

const MAP: Record<string, string> = {
  // Brand / nav
  "ZeroSync": "জিরোসিঙ্ক",
  "Dashboard": "ড্যাশবোর্ড",
  "My tasks": "আমার কাজ",
  "Personal": "ব্যক্তিগত",
  "Users": "ব্যবহারকারীগণ",
  "User": "ব্যবহারকারী",
  "Businesses": "ব্যবসা",
  "Business": "ব্যবসা",
  "Sign out": "সাইন আউট",
  "Sign in": "সাইন ইন",
  "Sign up": "সাইন আপ",
  "Signing in…": "সাইন ইন করা হচ্ছে…",
  "Navigation": "নেভিগেশন",
  "Open menu": "মেনু খুলুন",
  "Language": "ভাষা",

  // Common
  "Save": "সংরক্ষণ",
  "Save changes": "পরিবর্তন সংরক্ষণ",
  "Cancel": "বাতিল",
  "Delete": "মুছুন",
  "Edit": "সম্পাদনা",
  "Add": "যোগ করুন",
  "Create": "তৈরি করুন",
  "Update": "আপডেট",
  "Search": "অনুসন্ধান",
  "Loading…": "লোড হচ্ছে…",
  "Loading...": "লোড হচ্ছে…",
  "Actions": "ক্রিয়া",
  "Name": "নাম",
  "Role": "ভূমিকা",
  "Amount": "পরিমাণ",
  "Date": "তারিখ",
  "Note": "নোট",
  "Status": "স্ট্যাটাস",
  "Done": "সম্পন্ন",
  "All done": "সব সম্পন্ন",
  "Pending": "চলমান",
  "Today": "আজ",
  "Yesterday": "গতকাল",
  "Tomorrow": "আগামীকাল",
  "Total": "মোট",
  "Created": "তৈরি",
  "Tip": "পরামর্শ",
  "Error": "ত্রুটি",
  "Forbidden": "অনুমোদিত নয়",
  "Page not found": "পেজ পাওয়া যায়নি",
  "Username": "ইউজারনেম",
  "Password": "পাসওয়ার্ড",
  "Display name": "প্রদর্শিত নাম",

  // Roles
  "Admin": "অ্যাডমিন",
  "Owner": "মালিক",
  "Owners": "মালিকগণ",
  "Investor": "বিনিয়োগকারী",
  "Investors": "বিনিয়োগকারীগণ",
  "Member": "সদস্য",
  "Members": "সদস্যরা",
  "Worker": "কর্মী",
  "Workers": "কর্মীগণ",

  // Business tabs
  "Overview": "সারসংক্ষেপ",
  "People": "সদস্যরা",
  "Money": "অর্থ",
  "Tasks": "কাজ",
  "Profit": "মুনাফা",
  "Income": "আয়",
  "Expense": "ব্যয়",
  "Investment": "বিনিয়োগ",
  "Investments": "বিনিয়োগসমূহ",
  "Earning": "আয়",
  "Earnings": "আয়সমূহ",
  "Expenses": "ব্যয়সমূহ",
  "Invested": "বিনিয়োগকৃত",
  "Remaining": "অবশিষ্ট",
  "Transactions": "লেনদেনসমূহ",
  "Recipient": "প্রাপক",
  "Distribution log": "বণ্টন লগ",
  "Record distribution": "বণ্টন রেকর্ড করুন",
  "No distributions yet.": "এখনো কোনো বণ্টন নেই।",
  "No transactions yet.": "এখনো কোনো লেনদেন নেই।",
  "Use the form above to add one.": "যোগ করতে উপরের ফর্মটি ব্যবহার করুন।",
  "Pick a role": "একটি ভূমিকা নির্বাচন করুন",
  "Pick a user": "একজন ব্যবহারকারী নির্বাচন করুন",
  "Select a user…": "একজন ব্যবহারকারী নির্বাচন করুন…",
  "Add a person": "একজন ব্যক্তি যোগ করুন",
  "Add transaction": "লেনদেন যোগ করুন",
  "Add people": "সদস্য যোগ করুন",
  "Assign an existing user a role in this business.": "এই ব্যবসায় একজন বিদ্যমান ব্যবহারকারীকে ভূমিকা নির্ধারণ করুন।",
  "Member added": "সদস্য যোগ হয়েছে",
  "Failed to add member": "সদস্য যোগ করতে ব্যর্থ",
  "Failed to remove": "মুছতে ব্যর্থ",
  "Removed": "মুছে ফেলা হয়েছে",
  "Kind": "ধরন",
  "Party": "পক্ষ",

  // Money page
  "Record transaction": "লেনদেন রেকর্ড করুন",
  "Log an investment, earning, or expense.": "বিনিয়োগ, আয় বা ব্যয় লিপিবদ্ধ করুন।",
  "Tip: add people first so you can attribute transactions.": "পরামর্শ: লেনদেন বরাদ্দ করতে প্রথমে সদস্য যোগ করুন।",

  // Tasks
  "Previous week": "আগের সপ্তাহ",
  "Next week": "পরের সপ্তাহ",
  "This week": "এই সপ্তাহ",
  "Week summary": "সাপ্তাহিক সারসংক্ষেপ",
  "Completion by assignee": "দায়িত্বপ্রাপ্ত অনুযায়ী সম্পন্নতা",
  "No tasks scheduled": "কোনো কাজ নির্ধারিত নেই",
  "No tasks for this day": "এই দিনের জন্য কোনো কাজ নেই",
  "No tasks assigned.": "কোনো কাজ বরাদ্দ নেই।",
  "Add task": "কাজ যোগ করুন",
  "Add a task": "একটি কাজ যোগ করুন",
  "New task": "নতুন কাজ",
  "Create task": "কাজ তৈরি করুন",
  "Title": "শিরোনাম",
  "Details": "বিস্তারিত",
  "Assignee": "দায়িত্বপ্রাপ্ত",
  "Choose…": "নির্বাচন করুন…",
  "Mark done": "সম্পন্ন চিহ্নিত করুন",
  "Mark pending": "চলমান হিসেবে চিহ্নিত করুন",
  "Your assignments for the next 14 days.": "আগামী ১৪ দিনের জন্য আপনার কাজগুলো।",

  // Dashboard / personal
  "All businesses": "সকল ব্যবসা",
  "All businesses you have access to.": "আপনার অ্যাক্সেস থাকা সকল ব্যবসা।",
  "All profiles": "সকল প্রোফাইল",
  "New business": "নতুন ব্যবসা",
  "New profile": "নতুন প্রোফাইল",
  "Profile": "প্রোফাইল",
  "Profile name": "প্রোফাইলের নাম",
  "Personal profiles": "ব্যক্তিগত প্রোফাইল",
  "Personal ledger — fully separate from business accounts.": "ব্যক্তিগত খতিয়ান — ব্যবসার অ্যাকাউন্ট থেকে সম্পূর্ণ আলাদা।",
  "Logged immediately to this profile only.": "শুধু এই প্রোফাইলে তাৎক্ষণিকভাবে লিপিবদ্ধ।",
  "Separate from investments and expenses.": "বিনিয়োগ ও ব্যয় থেকে পৃথক।",
  "One per ledger you want to keep.": "প্রতিটি খতিয়ানের জন্য একটি।",
  "Create a workspace for tracking money & tasks.": "অর্থ ও কাজ ট্র্যাক করার জন্য একটি ওয়ার্কস্পেস তৈরি করুন।",
  "Track your own money, separate from any business.": "ব্যবসা থেকে আলাদাভাবে নিজের অর্থ ট্র্যাক করুন।",
  "No businesses yet. Create one to get started.": "এখনো কোনো ব্যবসা নেই। শুরু করতে একটি তৈরি করুন।",
  "No businesses assigned to you yet.": "এখনো কোনো ব্যবসা আপনাকে বরাদ্দ করা হয়নি।",
  "No personal profiles yet.": "এখনো কোনো ব্যক্তিগত প্রোফাইল নেই।",
  "Accounts are created by the administrator.": "অ্যাকাউন্ট অ্যাডমিনিস্ট্রেটর তৈরি করেন।",
  "Sign in failed": "সাইন ইন ব্যর্থ হয়েছে",

  // Heads (titles)
  "Sign in — ZeroSync": "সাইন ইন — জিরোসিঙ্ক",
  "Dashboard — ZeroSync": "ড্যাশবোর্ড — জিরোসিঙ্ক",
  "My tasks — ZeroSync": "আমার কাজ — জিরোসিঙ্ক",
  "Personal — ZeroSync": "ব্যক্তিগত — জিরোসিঙ্ক",
  "Profile — ZeroSync": "প্রোফাইল — জিরোসিঙ্ক",

  // Misc
  "Nothing here yet": "এখনও কিছু নেই",
  "unknown": "অজানা",
  "None.": "কিছু নেই।",
  "Open": "খুলুন",
};

// Word-level fallback so partial English fragments (e.g. inside concatenated
// strings) still get translated when the whole-string lookup misses.
const WORD_MAP: Record<string, string> = {
  "Dashboard": "ড্যাশবোর্ড",
  "Personal": "ব্যক্তিগত",
  "Businesses": "ব্যবসা",
  "Users": "ব্যবহারকারী",
  "Owner": "মালিক",
  "Investor": "বিনিয়োগকারী",
  "Member": "সদস্য",
  "Worker": "কর্মী",
  "total": "মোট",
  "of": "এর",
  "done": "সম্পন্ন",
  "pending": "চলমান",
};

const HAS_BANGLA = /[\u0980-\u09FF]/;
const HAS_LATIN = /[A-Za-z]/;

function translateText(s: string): string {
  if (!s) return s;
  const trimmed = s.trim();
  if (!trimmed || !HAS_LATIN.test(trimmed) || HAS_BANGLA.test(trimmed)) return s;
  if (MAP[trimmed]) {
    return s.replace(trimmed, MAP[trimmed]);
  }
  // Try lowercased lookup
  const low = trimmed.toLowerCase();
  for (const k of Object.keys(MAP)) {
    if (k.toLowerCase() === low) return s.replace(trimmed, MAP[k]);
  }
  // Word-level pass
  let out = s;
  let changed = false;
  for (const [en, bn] of Object.entries(WORD_MAP)) {
    const re = new RegExp(`\\b${en}\\b`, "g");
    if (re.test(out)) {
      out = out.replace(re, bn);
      changed = true;
    }
  }
  return changed ? out : s;
}

const TEXT_SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"]);

function walk(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (parent && TEXT_SKIP_TAGS.has(parent.tagName)) return;
    const t = node.nodeValue ?? "";
    const next = translateText(t);
    if (next !== t) node.nodeValue = next;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (TEXT_SKIP_TAGS.has(el.tagName)) return;

  for (const attr of ["placeholder", "title", "aria-label"]) {
    const v = el.getAttribute(attr);
    if (v) {
      const next = translateText(v);
      if (next !== v) el.setAttribute(attr, next);
    }
  }
  node.childNodes.forEach(walk);
}

let observer: MutationObserver | null = null;
let scheduled = false;

function scheduleScan() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    walk(document.body);
  });
}

export function enableAutoTranslate() {
  if (typeof document === "undefined") return;
  if (observer) return;
  walk(document.body);
  observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "title", "aria-label"],
  });
}

export function disableAutoTranslate() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  // Note: existing translated nodes won't be reverted; reload required to restore EN.
}
