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
  "Rename": "নাম পরিবর্তন",
  "Rename business": "ব্যবসার নাম পরিবর্তন",
  "Renamed": "নাম পরিবর্তিত হয়েছে",
  "Business deleted": "ব্যবসা মুছে ফেলা হয়েছে",
  "Failed to delete": "মুছতে ব্যর্থ",
  "Failed to rename": "নাম পরিবর্তনে ব্যর্থ",

  // Tabs
  "Loans": "ঋণ",
  "Accounts": "অ্যাকাউন্ট",
  "Budgets": "বাজেট",
  "Categories": "ক্যাটাগরি",

  // Overview stats
  "Net worth": "নিট সম্পদ",
  "This week spend": "এই সপ্তাহের ব্যয়",
  "This month spend": "এই মাসের ব্যয়",
  "Savings": "সঞ্চয়",
  "Spend by category": "ক্যাটাগরি অনুযায়ী ব্যয়",
  "This month": "এই মাস",
  "Last 30 days": "গত ৩০ দিন",
  "Income vs expense": "আয় বনাম ব্যয়",
  "Net worth — 30 days": "নিট সম্পদ — ৩০ দিন",
  "Running balance across all accounts": "সকল অ্যাকাউন্টের চলমান ব্যালেন্স",
  "Account balances": "অ্যাকাউন্টের ব্যালেন্স",
  "Opening + activity": "প্রারম্ভিক + কার্যক্রম",
  "Recent transactions": "সাম্প্রতিক লেনদেন",
  "No expenses yet this month.": "এই মাসে এখনো কোনো ব্যয় নেই।",
  "No accounts yet.": "এখনো কোনো অ্যাকাউন্ট নেই।",
  "this month": "এই মাসে",
  "remaining": "অবশিষ্ট",
  "day left": "দিন বাকি",
  "days left": "দিন বাকি",
  "projected": "প্রক্ষেপিত",

  // Transactions
  "Transaction added": "লেনদেন যোগ হয়েছে",
  "Failed to add": "যোগ করতে ব্যর্থ",
  "Deleted": "মুছে ফেলা হয়েছে",
  "Saved offline — will sync when back online": "অফলাইনে সংরক্ষিত — অনলাইনে এলে সিঙ্ক হবে",
  "Transfer": "স্থানান্তর",
  "Investment buy": "বিনিয়োগ ক্রয়",
  "Investment sell": "বিনিয়োগ বিক্রয়",
  "Savings deposit": "সঞ্চয় জমা",
  "Savings withdraw": "সঞ্চয় উত্তোলন",
  "Loan given": "প্রদত্ত ঋণ",
  "Loan taken": "গৃহীত ঋণ",
  "Repayment received": "ফেরত প্রাপ্ত",
  "Repayment paid": "ফেরত প্রদত্ত",
  "Account": "অ্যাকাউন্ট",
  "Category": "ক্যাটাগরি",
  "Counterparty": "পক্ষ",
  "Person": "ব্যক্তি",
  "Vendor": "বিক্রেতা",
  "Employer": "নিয়োগকর্তা",
  "Other": "অন্যান্য",
  "Transfer to": "স্থানান্তর গন্তব্য",
  "Linked loan": "সংযুক্ত ঋণ",
  "Filter": "ফিল্টার",
  "All": "সকল",
  "Search note…": "নোট অনুসন্ধান…",

  // Loans
  "I owe": "আমি দায়ী",
  "Owed to me": "আমার পাওনা",
  "I owe (open)": "আমি দায়ী (চলমান)",
  "Owed to me (open)": "আমার পাওনা (চলমান)",
  "Add loan": "ঋণ যোগ করুন",
  "Money you borrowed or money you lent.": "আপনি যে অর্থ ধার নিয়েছেন বা ধার দিয়েছেন।",
  "Direction": "দিক",
  "Person / vendor": "ব্যক্তি / বিক্রেতা",
  "Principal": "মূলধন",
  "Started": "শুরু",
  "Due (optional)": "নির্দিষ্ট তারিখ (ঐচ্ছিক)",
  "Loan added": "ঋণ যোগ হয়েছে",
  "Loan closed": "ঋণ বন্ধ করা হয়েছে",
  "Close": "বন্ধ করুন",
  "Closed": "বন্ধ",
  "Repayment": "ফেরত",
  "Repayment recorded": "ফেরত রেকর্ড হয়েছে",
  "Record repayment": "ফেরত রেকর্ড করুন",
  "Repaid": "ফেরতকৃত",
  "Outstanding": "বকেয়া",
  "I owed": "আমি দায়ী ছিলাম",
  "Was owed": "পাওনা ছিল",
  "Nothing here.": "কিছু নেই।",

  // Accounts
  "Add account": "অ্যাকাউন্ট যোগ করুন",
  "Cash, bank, card, wallet, savings, investment…": "ক্যাশ, ব্যাংক, কার্ড, ওয়ালেট, সঞ্চয়, বিনিয়োগ…",
  "Type": "ধরন",
  "Opening balance": "প্রারম্ভিক ব্যালেন্স",
  "Account added": "অ্যাকাউন্ট যোগ হয়েছে",
  "cash": "ক্যাশ",
  "bank": "ব্যাংক",
  "wallet": "ওয়ালেট",
  "card": "কার্ড",
  "investment": "বিনিয়োগ",
  "savings": "সঞ্চয়",
  "other": "অন্যান্য",

  // Budgets
  "Add budget": "বাজেট যোগ করুন",
  "Weekly or monthly cap. Leave category empty to track overall expenses.": "সাপ্তাহিক বা মাসিক সীমা। সামগ্রিক ব্যয় ট্র্যাক করতে ক্যাটাগরি খালি রাখুন।",
  "Period": "সময়কাল",
  "Weekly": "সাপ্তাহিক",
  "Monthly": "মাসিক",
  "Category (optional)": "ক্যাটাগরি (ঐচ্ছিক)",
  "Overall": "সামগ্রিক",
  "Budget added": "বাজেট যোগ হয়েছে",
  "No budgets yet.": "এখনো কোনো বাজেট নেই।",
  "week": "সপ্তাহ",
  "month": "মাস",
  "weekly": "সাপ্তাহিক",
  "monthly": "মাসিক",
  "remaining of weekly budget": "সাপ্তাহিক বাজেটের অবশিষ্ট",
  "remaining of monthly budget": "মাসিক বাজেটের অবশিষ্ট",
  "budget exceeded": "বাজেট অতিক্রান্ত",
  "used": "ব্যবহৃত",
  "left": "অবশিষ্ট",

  // Categories
  "Add category": "ক্যাটাগরি যোগ করুন",
  "Category added": "ক্যাটাগরি যোগ হয়েছে",
  "Color": "রঙ",

  // People (counterparties)
  "Add person / vendor": "ব্যক্তি / বিক্রেতা যোগ করুন",
  "Who you pay, who pays you, who owes you.": "আপনি যাকে প্রদান করেন, যিনি প্রদান করেন, যিনি দায়ী।",
  "People & vendors": "ব্যক্তি ও বিক্রেতা",
  "No people added yet.": "এখনো কোনো ব্যক্তি যোগ করা হয়নি।",

  // Offline / sync
  "Offline": "অফলাইন",
  "pending": "চলমান",
  "Syncing": "সিঙ্ক হচ্ছে",
  "change": "পরিবর্তন",
  "changes": "পরিবর্তনসমূহ",

  // Chat
  "Chat": "চ্যাট",
  "Conversations": "কথোপকথন",
  "Private": "ব্যক্তিগত",
  "Group": "গ্রুপ",
  "Direct": "সরাসরি",
  "No conversations yet. They appear automatically when you join a business.":
    "এখনো কোনো কথোপকথন নেই। ব্যবসায় যোগ দিলে স্বয়ংক্রিয়ভাবে দেখাবে।",
  "No messages yet": "এখনো কোনো বার্তা নেই",
  "No messages yet. Say hi!": "এখনো কোনো বার্তা নেই। হাই বলুন!",
  "No messages yet · Say hi!": "এখনো কোনো বার্তা নেই · হাই বলুন!",
  "Select a conversation to start chatting.": "চ্যাট শুরু করতে একটি কথোপকথন বেছে নিন।",
  "Select a conversation": "একটি কথোপকথন বেছে নিন",
  "Type a message…": "একটি বার্তা লিখুন…",
  "Type a message...": "একটি বার্তা লিখুন…",
  "Send": "পাঠান",
  "Reply": "উত্তর",
  "Replying to": "উত্তর দিচ্ছেন",
  "Cancel reply": "উত্তর বাতিল",
  "Back": "পেছনে",
  "Start a private chat": "ব্যক্তিগত চ্যাট শুরু করুন",
  "Search people…": "মানুষ খুঁজুন…",
  "Search people...": "মানুষ খুঁজুন…",
  "No people available. You can only chat with members of businesses you share.":
    "কেউ উপলব্ধ নেই। আপনি কেবল একই ব্যবসার সদস্যদের সাথে চ্যাট করতে পারেন।",
  "members": "সদস্য",
  "member": "সদস্য",
  "No messages yet.": "এখনো কোনো বার্তা নেই।",
  "Group · No messages yet": "গ্রুপ · এখনো কোনো বার্তা নেই",
  "Send the first message to start the conversation.": "কথোপকথন শুরু করতে প্রথম বার্তা পাঠান।",
  "now": "এখন",
  "Sending": "পাঠানো হচ্ছে",
  "Sent": "পাঠানো হয়েছে",
  "Seen": "দেখেছে",
  "Group members": "গ্রুপ সদস্য",
  "New messages": "নতুন বার্তা",
  "Scroll to latest": "সর্বশেষে যান",
  "typing…": "টাইপ করছে…",
  "is typing…": "টাইপ করছে…",

  // My tasks (extras)
  "Task actions": "কাজের ক্রিয়া",
  "Mark as done": "সম্পন্ন চিহ্নিত করুন",
  "Mark as not done": "অসম্পন্ন চিহ্নিত করুন",
  "Add remark": "মন্তব্য যোগ করুন",
  "Edit remark": "মন্তব্য সম্পাদনা",
  "Delete task": "কাজ মুছুন",
  "Remark": "মন্তব্য",
  "Remark saved": "মন্তব্য সংরক্ষিত হয়েছে",
  "Failed to save remark": "মন্তব্য সংরক্ষণে ব্যর্থ",
  "Task deleted": "কাজ মুছে ফেলা হয়েছে",
  "Failed to delete task": "কাজ মুছতে ব্যর্থ",
  "Failed to update task": "কাজ আপডেট করতে ব্যর্থ",
  "Delete this task?": "এই কাজটি মুছবেন?",
  "This task will be permanently removed.": "এই কাজটি স্থায়ীভাবে মুছে ফেলা হবে।",
  "Save remark": "মন্তব্য সংরক্ষণ",
  "Saving…": "সংরক্ষণ হচ্ছে…",
  "Clear": "পরিষ্কার",
  "Explain progress, blockers, or why this task is still pending. The person who created it will see this note.":
    "অগ্রগতি, বাধা বা কাজটি এখনও কেন বাকি তা ব্যাখ্যা করুন। যিনি কাজটি তৈরি করেছেন তিনি এই নোটটি দেখবেন।",
  "e.g. Blocked on vendor reply — expecting answer Monday.":
    "যেমন: বিক্রেতার উত্তরের জন্য আটকে আছে — সোমবার উত্তর প্রত্যাশিত।",
  "due": "বকেয়া",
  "open": "চলমান",

  // Notebook
  "Notebook": "নোটবুক",
  "Lists & notes": "তালিকা ও নোট",
  "Previous day": "আগের দিন",
  "Next day": "পরের দিন",
  "Overdue": "অতিদেয়",
  "Someday": "যেকোনো সময়",
  "Nothing scheduled. Add one below.": "কিছু নির্ধারিত নেই। নিচে একটি যোগ করুন।",
  "Notes": "নোট",
  "Todos": "কাজসমূহ",
  "New note": "নতুন নোট",
  "No notes in this list.": "এই তালিকায় কোনো নোট নেই।",
  "No todos. Add one below.": "কোনো কাজ নেই। নিচে একটি যোগ করুন।",
  "No lists yet": "এখনো কোনো তালিকা নেই",
  "Create one above to start organizing notes and todos.":
    "নোট ও কাজ সাজাতে উপরে একটি তৈরি করুন।",
  "List": "তালিকা",
  "Untitled": "শিরোনামহীন",
  "New list (e.g. Groceries)": "নতুন তালিকা (যেমন: কেনাকাটা)",
  "Add a task…": "একটি কাজ যোগ করুন…",
  "Add a task to this list…": "এই তালিকায় একটি কাজ যোগ করুন…",
  "Back to lists": "তালিকায় ফিরুন",
  "Delete list": "তালিকা মুছুন",
  "Delete this list? Notes and todos inside will be unlinked but kept.":
    "এই তালিকাটি মুছবেন? ভেতরের নোট ও কাজগুলো সংযোগমুক্ত হবে তবে রক্ষিত থাকবে।",
  "Pin": "পিন",
  "Unpin": "পিন সরান",
  "Preview": "প্রিভিউ",
  "Note title": "নোটের শিরোনাম",
  "Delete this note?": "এই নোটটি মুছবেন?",
  "Failed to load note.": "নোট লোড করতে ব্যর্থ।",
  "Autosaved": "স্বয়ংক্রিয়ভাবে সংরক্ষিত",
  "Save now": "এখনই সংরক্ষণ",
  "Start writing… Use - [ ] for todos, # for headings, **bold**, *italic*.":
    "লেখা শুরু করুন… কাজের জন্য - [ ], হেডিং-এর জন্য #, **মোটা**, *ইটালিক* ব্যবহার করুন।",
  "Delete this todo?": "এই কাজটি মুছবেন?",
  "Low": "নিম্ন",
  "Med": "মাঝারি",
  "High": "উচ্চ",

  // Heads
  "Today — Notebook — ZeroSync": "আজ — নোটবুক — জিরোসিঙ্ক",
  "Lists — Notebook — ZeroSync": "তালিকা — নোটবুক — জিরোসিঙ্ক",
  "List — Notebook — ZeroSync": "তালিকা — নোটবুক — জিরোসিঙ্ক",
  "Note — Notebook — ZeroSync": "নোট — নোটবুক — জিরোসিঙ্ক",
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
  "members": "সদস্য",
  "member": "সদস্য",
  "Group": "গ্রুপ",
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
