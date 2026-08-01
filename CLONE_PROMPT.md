# ZeroSync / ZeroTrack — Full Clone Prompt (for a new Lovable account)

Give the text inside the code block below to the AI in the **new** Lovable project,
one step at a time (Step 0 first, then Step 1, etc.). Everything it needs is in here.

Two files matter:
- `CLONE_SCHEMA.sql` — the complete database structure (run once in the new Supabase project)
- this file — the instructions

---

## PROMPT TO PASTE (Step 0 — get the code in)

```
I want to clone an existing app into this project, exactly as-is.

Source repository: https://github.com/Cyph3rN0ir/zdtracker.git

Do this:
1. Connect this Lovable project to GitHub (Plus (+) menu -> GitHub -> Connect project),
   so we get a repo that syncs both ways.
2. Bring the full contents of https://github.com/Cyph3rN0ir/zdtracker.git into this
   project, replacing whatever the template shipped with. Keep the structure identical:
   - it is a TanStack Start (React 19 + Vite 7 + Tailwind v4) app
   - routes live in src/routes (file-based), server logic in src/lib/*.functions.ts
     and *.server.ts
   - PWA files are public/sw.js, public/push-sw.js, public/manifest.webmanifest
   Do NOT switch routers, do NOT restructure folders, do NOT "modernise" anything.
   If a file exists in both places, the repo version wins.
3. Install all dependencies from the repo's package.json (bun install), then run the
   dev server and confirm the app builds and the /auth page renders.

Important: this app does NOT use Supabase Auth. It has its own username/password
login (bcrypt hashes in an app_users table) with cookie sessions, and the server
talks to Supabase with the service_role key only. Do not replace this with
Supabase Auth, Lovable Cloud auth, or RLS-based user auth.

Report back when the code is in and the app compiles.
```

---

## PROMPT TO PASTE (Step 1 — database)

```
Now set up the database. I have created a fresh Supabase project and I will give you
the credentials.

1. Open the file CLONE_SCHEMA.sql in the repo. It contains the COMPLETE structure of
   the original database: 20 tables, all foreign keys, check constraints, indexes,
   3 chat trigger functions + triggers, RLS enabled everywhere, privileges granted
   only to service_role, and a seeded admin user.
2. Run that entire file once in the new Supabase project (SQL Editor -> New query ->
   paste -> Run). It is idempotent, so re-running is safe.
3. Confirm afterwards that these 20 tables exist:
   app_users, businesses, business_members, business_accounts, business_transactions,
   tasks, personal_profiles, personal_accounts, personal_categories,
   personal_counterparties, personal_loans, personal_budgets, personal_transactions,
   note_lists, notes, todos, conversations, conversation_members, messages,
   push_subscriptions
   and that the 3 triggers exist on businesses / business_members.

Do NOT enable Supabase Auth, do NOT add anon/authenticated policies, do NOT put the
tables in the realtime publication (the app uses realtime broadcast + polling only).
```

---

## PROMPT TO PASTE (Step 2 — secrets / making it run)

```
Store these as project secrets (backend env vars). The app reads them with
process.env inside server functions:

  ZT_SUPABASE_URL                 = https://<new-project-ref>.supabase.co
  ZT_SUPABASE_SERVICE_ROLE_KEY    = <new project's service_role key>
  SESSION_SECRET                  = <random 64-char string, generate it>
  VAPID_PUBLIC_KEY                = <web push public key>
  VAPID_PRIVATE_KEY               = <web push private key>
  VAPID_SUBJECT                   = mailto:<my email>

Notes:
- src/lib/supabase.server.ts has the ORIGINAL project URL hardcoded as a fallback.
  Replace that fallback with the new project URL (or remove the fallback so the env
  var is required). This is mandatory — otherwise the clone writes into the old database.
- Web push: generate a NEW VAPID key pair (npx web-push generate-vapid-keys).
  Then open src/lib/push-config.ts and replace the hardcoded VAPID_PUBLIC_KEY constant
  with the new PUBLIC key. It must match the VAPID_PUBLIC_KEY secret exactly, or
  notifications will silently fail.
- Push only works over HTTPS on the published domain, not in the editor preview.

Then publish the project and give me the live URL.
```

---

## PROMPT TO PASTE (Step 3 — verify the clone)

```
Verify the clone end to end and fix anything broken:

1. Log in with admin / 1234 at /auth, then immediately change that password from
   /admin/users.
2. /admin/users — create a user; confirm only role "admin" can manage things.
3. /businesses — create a business. Confirm a group chat conversation is auto-created
   (trigger), then check the tabs: Overview, People, Money, Profit, Accounts, Equity,
   Tasks. Adding a member must also add them to the business group chat.
4. /personal — create a profile; test accounts, categories, transactions, loans
   (including "Settle up" bulk repayment) and the "Balances by person" card.
5. /notebook — lists, notes (markdown autosave), todos, Today view.
6. /chat — send a message; check read receipts, typing indicator, member sheet.
7. /my/tasks — mark done, add remark, delete.
8. /settings — theme switcher (default theme must be "ZeroDesk Classic", dark #0F0F0F
   with #B6D733 accent), Bangla language toggle (every label must translate), and
   Enable notifications.
9. Install as a PWA on a phone and confirm offline mode: the last loaded state should
   still render, and the online/offline pill should be accurate.

Report anything that fails with the exact error instead of guessing.
```

---

## Reference — what the app is (for whoever runs the clone)

| Area | Detail |
| --- | --- |
| Stack | TanStack Start v1, React 19, Vite 7, Tailwind v4, shadcn/ui, Recharts |
| Auth | custom: `app_users` + bcryptjs + `useSession` cookie (`zt_session`) |
| DB access | service_role only, from `src/lib/supabase.server.ts` |
| Roles | `admin` (full CRUD everywhere), `owner` / `investor` / `member` (viewers) |
| Modules | Businesses (money, accounts, profit, equity, tasks, people), Personal finance, Notebook, Chat, Web push, Admin |
| PWA | `public/sw.js` (offline shell), `public/push-sw.js` (notifications), IndexedDB React Query persistence |
| i18n | English + Bangla via `src/lib/i18n.tsx` + `src/lib/auto-translate.ts` |
| Currency | BDT (business accounts default), personal accounts default INR |

### Security note
The Supabase management/access token and service_role key of the ORIGINAL project were
shared in chat. Rotate them in the original project (Supabase Dashboard -> Account ->
Access Tokens, and Project Settings -> API -> rotate service_role). The clone must use
its own fresh keys — never the original ones.
