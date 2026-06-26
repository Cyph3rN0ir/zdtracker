# Chat UX Enhancement Plan

After auditing `src/routes/_app.chat.tsx`, `src/routes/_app.chat.$conversationId.tsx`, `src/lib/chat.functions.ts`, and `src/lib/chat.server.ts`, here are the friction points and the phased fixes.

## Root causes found

1. **Send feels laggy.** `sendMessageFn` waits for server roundtrip, then `invalidateQueries` triggers a fresh `listMessagesFn` fetch. The user's message only appears ~300–800ms after they hit Enter. No optimistic UI.
2. **Conversation list is slow on first paint.** `listConversationsFn` runs N+1 queries (1 message query + 1 unread-count query per conversation). With 10 chats that's 20+ round-trips on every refresh (every 15s).
3. **Auto-scroll is fragile.** Only fires on `lastMsgId` change. If the user has scrolled up to read history and a new message arrives, the view jumps. No "scroll to bottom" affordance, no "new messages ↓" pill.
4. **Mark-read fires too often & echoes channel noise.** `markReadFn` runs in `useEffect` on every `msgsQ.data` change, even when the tab is hidden. Each call broadcasts back to the same channel, causing the sender to re-invalidate and refetch.
5. **Composer doesn't grow.** Textarea is locked at `h-10`. Multi-line drafts hide behind a scrollbar inside a 40px box.
6. **No focus management.** Switching threads or sending leaves focus wherever it was — keyboard users have to click back.
7. **Sidebar timestamps missing.** Conversation list shows last message body but never the time, so you can't tell what's recent.
8. **Mobile back-nav loses context.** Back button uses `navigate({to:"/chat"})` instead of router back, so iOS swipe-back history is broken.

## Phases

### Phase 1 — Instant send (optimistic UI)
- In `sendMessage` mutation: `onMutate` appends a temp message `{ id: "tmp-…", mine: true, body, createdAt: now, pending: true }` to the `["chat","messages",id]` cache and clears the input immediately.
- `onSuccess` lets the next realtime ping or refetch reconcile (temp gets replaced by real row on next list).
- `onError` rolls back and restores the draft text.
- Add a subtle pending state (lower opacity + clock icon) on the bubble until reconciled.

### Phase 2 — Faster conversation list
- Rewrite `listConversationsFn` to issue **2 queries total**: one batched `messages` query (latest per conv via `distinct on` RPC or grouped fetch with `in()`), one batched unread count using a SQL view or an RPC `chat_unread_counts(uid)`.
- Add an RPC `chat_conversations_overview(uid)` returning everything in one round-trip; fall back to the current code if the RPC is missing.
- Drop refetchInterval to 30s; rely on realtime pings.

### Phase 3 — Smarter scroll
- Track "is user at bottom" via a ref + scroll listener (threshold 80px).
- Auto-scroll on new message **only if** already at bottom OR the message is mine.
- Otherwise show a floating "↓ N new messages" pill above the composer; clicking it scrolls and clears.
- Always scroll to bottom on initial open and on thread switch.

### Phase 4 — Quieter mark-read & realtime
- Only call `markReadFn` when `document.visibilityState === "visible"` AND the window is focused AND user is at bottom.
- Debounce mark-read to once per 2s per conversation.
- Filter out self-originated broadcasts (already partially done for typing; extend to ping by passing `senderId` in the payload and ignoring it in the listener).

### Phase 5 — Composer & focus polish
- Auto-grow textarea (1–6 rows) by measuring `scrollHeight`.
- Focus textarea on mount, after send, and after thread switch.
- Show character counter when > 3500/4000.
- Disable Send while empty with smooth opacity transition; Cmd/Ctrl+Enter also sends.
- Preserve draft per conversation in `sessionStorage` so accidental navigation doesn't lose text.

### Phase 6 — Sidebar polish & mobile
- Show relative time in conversation list (`2m`, `1h`, `Yesterday`, `Mon`).
- Bold the last-message line when `unread > 0`.
- Replace `navigate({to:"/chat"})` back button with `router.history.back()` (fallback to `/chat`).
- Add subtle haptic-style press feedback (`active:scale-[0.98]`) on send button for mobile.
- Ensure conversation list rows have `min-h-[64px]` for comfortable touch targets.

### Phase 7 — Skeletons & empty states
- Replace "Loading…" text with shimmer skeleton rows in sidebar and message bubbles for perceived speed.
- Improve empty thread state with an icon + suggestion ("Send the first message in this conversation").

## Tech notes (internal)

- All changes are scoped to: `src/routes/_app.chat.tsx`, `src/routes/_app.chat.$conversationId.tsx`, `src/lib/chat.functions.ts`, and optionally one new Supabase RPC migration for Phase 2.
- Realtime channel naming stays the same so no client/server protocol break.
- No schema changes required for Phases 1, 3, 4, 5, 6, 7. Phase 2 adds an RPC only.

Reply **"proceed phase 1"** (or any phase) to start, or **"proceed all"** to run them sequentially.
