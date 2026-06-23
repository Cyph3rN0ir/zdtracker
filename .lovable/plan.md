
## Root-cause analysis

### 1. "Savings rate 100%" bug
In `src/components/personal/Overview.tsx` the "Savings rate" tile uses
`(monthIncome - monthSpend) / monthIncome`. If you log a `savings_deposit` but no `income` row, `monthIncome = 0` and the function returns `0%`. When income > 0 and spend = 0 it becomes `100%`. It's not actually showing what you saved — and it ignores the savings-type accounts entirely.

### 2. Monthly budget "not deducting"
`computeBudgetStatus` in `src/lib/personal-finance.ts` is correct — BUT `BudgetsTab` only shows budgets for the selected period filter (none — it shows all), while `PersonalOverview` only renders `weeklyBudgets.slice(0, 1)` + `monthlyBudgets.slice(0, 1)`. The actual bug: budgets that have `category_id = null` (overall) DO count every expense — but budgets created with the "Overall" category filter aren't being matched because the Add-budget form stores empty string `""` not `null`, and the row gets persisted as `""`, then `b.category_id ? ... : true` is **truthy for `""`? No** — `"" → false`, so overall works. Real issue: the monthly budget tile re-uses the same week-window calc when the period field is stored but the `start_date` predates the window — `computeBudgetStatus` ignores `start_date` and uses the current month, so it works… EXCEPT the Overview only shows the first weekly + first monthly budget. If the user only sees the weekly one decreasing, it's because the monthly tile picked an unrelated budget. Need to verify by showing period-tagged tiles and recompute correctly.

### 3. Risky Delete button
On `src/routes/_app.businesses.$id.tsx` and `src/routes/_app.index.tsx` the trash icon sits right next to "Open". Confirmation dialog exists, but the icon position is dangerous on touch. No rename action exists.

### 4. PWA offline + refresh
Currently `public/sw.js` is a kill-switch. There's no offline cache, no background sync, no pull-to-refresh.

---

## Implementation phases

### Phase 1 — Savings feature redesign (Overview)
- Replace the "Savings rate" stat with **"Savings balance"**: sum of balances across accounts where `type = 'savings'` (computed the same way as `accountBalances`).
- Add a second small line under it: "+₹X this month" — net deposits − withdrawals in the current month (or net change to savings accounts this month).
- Keep savings as a spendable fund: no logic change needed — `savings_withdraw` is already an "in" direction that increases other-account balance; the user can already spend from it.
- File: `src/components/personal/Overview.tsx` (stat card + new helper, no schema change).

### Phase 2 — Budget logic fix
- In `Overview.tsx`, render **all** active monthly + weekly budgets (not just `.slice(0,1)`) in a responsive grid so the user can see the monthly one decreasing.
- In `computeBudgetStatus`, respect `start_date`: if `b.start_date > start`, clamp the window's `start` to `b.start_date`. Prevents an old monthly budget from looking "stuck" if it was created mid-period.
- Verify `BudgetsTab` sends `categoryId: null` (not `""`) when overall — already does (`categoryId || null`). No change.
- Files: `src/lib/personal-finance.ts`, `src/components/personal/Overview.tsx`.

### Phase 3 — Safer business actions + rename
- Add `renameBusinessFn` server fn (admin-only, `UPDATE businesses SET name = ... WHERE id = ...`).
- In `_app.businesses.$id.tsx`: move Delete out of the header into a `DropdownMenu` (3-dot icon) with **Rename** and **Delete** items. Delete still opens the existing `AlertDialog`.
- In `_app.index.tsx` table row: replace the inline trash icon with the same 3-dot `DropdownMenu` (Rename / Delete) — same confirmation dialog.
- Files: `src/lib/zt.functions.ts`, `src/routes/_app.businesses.$id.tsx`, `src/routes/_app.index.tsx`.

### Phase 4 — PWA offline + sync
- Replace kill-switch `public/sw.js` with a **NetworkFirst** service worker for HTML navigations + **CacheFirst** for `/assets/*` hashed files + `offline.html` fallback. Hand-written, no `vite-plugin-pwa` re-add (per project rule).
- Register it from `src/lib/pwa-update-toast.tsx` ONLY in production + not in Lovable preview + not in iframe + skip on `?sw=off` (per skill/pwa rules).
- Read queue: Tanstack Query already caches; with the SW caching HTML + JS chunks, the app shell loads offline and shows last-cached data.
- Write queue (mutations while offline): wrap each mutation hook used in personal tracker with a tiny `offlineQueue` helper (`src/lib/offline-queue.ts`) that:
  - When `navigator.onLine === false`, stores `{ fnName, args, ts }` in `localStorage`.
  - On `window 'online'` event, replays in order and `qc.invalidateQueries()` on success; toast progress.
  - Server fns are addressed by string name → resolved via a small registry map.
- Scope: apply queue to the high-traffic personal mutations only (`addTx`, `upsertBudget`, `upsertAccount`, `upsertCategory`) — not business admin actions.

### Phase 5 — Pull-to-refresh in PWA
- Add `src/components/PullToRefresh.tsx`: a thin wrapper that uses touch events to detect a >70px pull from `scrollTop === 0`, shows a spinner, and calls `queryClient.invalidateQueries()` + `router.invalidate()` on release.
- Mount it once in `src/routes/_app.tsx` around `<Outlet />` so it covers every authenticated page.
- Desktop: unaffected (touch events only).

---

## Technical details

- **Sync conflict policy**: last-write-wins (server timestamp). Acceptable because all mutations are user-scoped via RLS and the user only edits their own rows.
- **SW caching strategy**: `NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 3 })` for navigations; `CacheFirst` for `/assets/`; bypass everything else (Supabase calls go straight to network — they need a live session anyway, no caching).
- **No new DB migration** required for Phases 1–3 (rename uses existing `businesses.name` column). Phases 4–5 are purely client.
- **No re-adding `vite-plugin-pwa`** — sw.js stays hand-written per the existing project decision.

---

## Files touched

```text
src/lib/personal-finance.ts            # start_date clamp in computeBudgetStatus
src/components/personal/Overview.tsx   # Savings card + render all budgets
src/lib/zt.functions.ts                # renameBusinessFn
src/routes/_app.businesses.$id.tsx     # 3-dot menu (Rename / Delete)
src/routes/_app.index.tsx              # 3-dot menu in row
src/lib/offline-queue.ts               # NEW — localStorage mutation queue
src/lib/pwa-update-toast.tsx           # register guarded SW
public/sw.js                           # NetworkFirst pages + CacheFirst assets + offline fallback
src/components/PullToRefresh.tsx       # NEW — touch pull gesture
src/routes/_app.tsx                    # wrap Outlet with PullToRefresh
```

Shall I proceed with all 5 phases?
