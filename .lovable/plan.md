# Polish Pass — Top Routes

Direction: keep the current minimal aesthetic; tighten rhythm, fix mobile rough edges, smooth transitions, add restrained motion. No new features, no design overhaul.

## Phase 1 — Foundations (shared)
- Audit `PageHeader`, `EmptyState`, `Card`, `Sheet`, `Tabs`, `Dialog` for spacing & type-scale drift; unify to one rhythm (header h1 size, subtitle muted, 4/8/12/16 spacing scale).
- Standardize page container: `mx-auto w-full max-w-5xl px-3 sm:px-6` and consistent top padding.
- Tighten button + input sizing (h-9 default, h-10 on mobile-touch surfaces).
- Add a tiny `<FadeIn>` wrapper (framer-motion, 120ms) and use on route content roots for a smoother transition than blank → mounted.

## Phase 2 — `/` and `/my/tasks`
- Verify home cards/quick-actions align with new container width; mobile two-column → single-column at <360px.
- Tasks: tighten Today/Tomorrow/Later/Due headers (smaller, uppercase, tracked); reduce row vertical padding; bigger tap targets on the action menu; ensure long titles + details wrap (`min-w-0`, `[overflow-wrap:anywhere]`).
- Skeletons match real row height to remove layout shift.

## Phase 3 — `/notebook`
- Today / Lists / Editor: align headers and spacing with Tasks.
- QuickAdd: confirm one-line pill on mobile, no horizontal scroll.
- Editor: comfortable max-width for prose, sticky save state, mobile keyboard-safe bottom padding.

## Phase 4 — `/chat`
- Sidebar/list rows: consistent 56px height, 1-line title + 1-line preview + time/unread; truncate cleanly.
- Conversation: composer pinned bottom, dvh-correct on iOS, no auto-zoom; typing/seen indicators sized down.
- Subtle message-enter motion (opacity+translateY, 120ms) only on new messages, never on history.

## Phase 5 — `/personal`
- Tabs row: scrollable on mobile without scrollbar; sticky under header.
- Transaction/Loan/Account rows: 2-column grid `[minmax(0,1fr)_auto]`, amounts right-aligned with tabular-nums, anywhere-wrap for long notes.
- Edit/Delete icon buttons unified size (h-8 w-8) and grouped.

## Phase 6 — `/businesses`
- Business detail tabs: same tabs treatment as Personal.
- Tasks tab: same row treatment as `/my/tasks` (already aligned details rendering).
- Members/list cards: tighter density, consistent avatar size.

## Phase 7 — Performance & smoothness (cross-cutting)
- `defaultPendingMs`/`defaultPendingMinMs` tuned so skeletons don't flash on fast loads.
- Add `content-visibility: auto` to long lists (tasks, transactions, messages history) for cheaper scroll.
- Lazy-mount heavy dialogs (Edit dialogs) so they don't ship with the route.
- Verify route preload on intent + viewport is still active.

## Phase 8 — Final QA
- Run a desktop + mobile screenshot pass on each route via Playwright; fix any remaining overflow/alignment regressions.
- Verify Bangla toggle still translates all touched strings.

### Workflow
One phase per turn; after each I'll report what changed and wait for "proceed to next phase".
