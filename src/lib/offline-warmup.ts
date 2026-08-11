// Phase 2: proactive offline warmup.
//
// After login (and again when the network returns), prefetch a bounded "core
// working set" of queries into React Query's IndexedDB-persisted cache so
// that — even if the user has never opened those pages before — the data is
// available on a cold offline launch.
//
// Bounded by design: we cannot prefetch every per-id route, so we cap each
// nested fan-out (first 20 businesses, first 20 lists, etc.). Each prefetch
// uses a moderate `staleTime` so it isn't a thrash storm on every navigation.
//
// Query keys MUST match the keys the components use, or warmup writes a
// parallel cache the components never read. See each call site below.

import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { OFFLINE_BOUNDS } from "@/lib/offline-manifest";
import type { OfflineLoaders } from "@/lib/offline-loaders";
import { persistQueryCacheNow } from "@/lib/query-persister";
const FIVE_MIN = OFFLINE_BOUNDS.STALE_TIME_MS;
const DOWNLOAD_PHASES = 6;

export type OfflineDownloadProgress = {
  phase: string;
  completed: number;
  total: number;
};

export type OfflineDownloadResult = {
  queryCount: number;
  businesses: number;
  profiles: number;
  conversations: number;
  savedAt: number;
};

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Matches _app.businesses.$id.tasks.tsx::startOfWeek (Mon-anchored, local TZ).
function startOfWeekISO(): string {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0, 10);
}

function requireRows<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} returned an invalid response`);
  return value as T[];
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

let warmupInFlight: Promise<void> | null = null;

export function runOfflineWarmup(qc: QueryClient, loaders: OfflineLoaders): Promise<void> {
  if (warmupInFlight) return warmupInFlight;
  warmupInFlight = doWarmup(qc, loaders).finally(() => {
    warmupInFlight = null;
  });
  return warmupInFlight;
}

export async function downloadOfflineData(
  qc: QueryClient,
  loaders: OfflineLoaders,
  onProgress?: (progress: OfflineDownloadProgress) => void,
): Promise<OfflineDownloadResult> {
  if (!onlineManager.isOnline()) throw new Error("Connect to the internet before downloading");
  if (warmupInFlight) await warmupInFlight;

  const report = (phase: string, completed: number) =>
    onProgress?.({ phase, completed, total: DOWNLOAD_PHASES });
  const today = localToday();
  const weekStart = startOfWeekISO();

  // The explicit download deliberately bypasses prefetchQuery. Mobile drawer
  // and connectivity state updates can cancel background prefetches; direct
  // authenticated calls followed by setQueryData form an atomic checkpoint.
  report("Downloading core lists", 0);
  const [businessValue, taskValue, profileValue, listValue, todayValue, unreadValue, chatValue] =
    await Promise.all([
      loaders.listBusinesses(),
      loaders.listMyTasks(),
      loaders.listPersonalProfiles(),
      loaders.listNotebookLists(),
      loaders.listTodos({
        data: { from: today, to: today, includeOverdue: true, includeUnscheduled: true },
      }),
      loaders.unreadTotal(),
      loaders.listConversations(),
    ]);

  const businesses = requireRows<{ id: string }>(businessValue, "Businesses");
  const profiles = requireRows<{ id: string }>(profileValue, "Personal profiles");
  const lists = requireRows<{ id: string }>(listValue, "Notebook lists");
  const conversations = requireRows<{ id: string }>(chatValue, "Conversations");
  qc.setQueryData(["businesses"], businessValue);
  qc.setQueryData(["my-tasks"], taskValue);
  qc.setQueryData(["personal"], profileValue);
  qc.setQueryData(["notebook", "lists"], listValue);
  qc.setQueryData(["notebook", "today", today], todayValue);
  qc.setQueryData(["chat", "unread-total"], unreadValue);
  qc.setQueryData(["chat", "conversations"], chatValue);

  report("Downloading recent conversations", 1);
  await Promise.all(
    conversations.slice(0, OFFLINE_BOUNDS.MAX_CONVERSATIONS).map(async (conversation) => {
      const [conversationValue, messageValue] = await Promise.all([
        loaders.getConversation({ data: { conversationId: conversation.id } }),
        loaders.listMessages({ data: { conversationId: conversation.id, limit: 100 } }),
      ]);
      qc.setQueryData(["chat", "conv", conversation.id], conversationValue);
      qc.setQueryData(["chat", "messages", conversation.id], messageValue);
    }),
  );

  report("Downloading notebook", 2);
  await Promise.all(
    lists.slice(0, OFFLINE_BOUNDS.MAX_LISTS).map(async (list) => {
      const [noteValue, todoValue] = await Promise.all([
        loaders.listNotes({ data: { listId: list.id } }),
        loaders.listTodos({ data: { listId: list.id, includeUnscheduled: true } }),
      ]);
      qc.setQueryData(["notebook", "notes", list.id], noteValue);
      qc.setQueryData(["notebook", "list-todos", list.id], todoValue);
      requireRows<{ id: string }>(noteValue, "Notebook notes").forEach((note) =>
        qc.setQueryData(["notebook", "note", note.id], note),
      );
    }),
  );

  report("Downloading businesses", 3);
  await Promise.all(
    businesses.slice(0, OFFLINE_BOUNDS.MAX_BUSINESSES).map(async (business) => {
      const [detail, members, tasks, transactions, accountList, balances] = await Promise.all([
        loaders.getBusiness({ data: { id: business.id } }),
        loaders.listMembers({ data: { businessId: business.id } }),
        loaders.listBusinessTasks({ data: { businessId: business.id, weekStart } }),
        loaders.listTransactions({ data: { businessId: business.id } }),
        loaders.listBusinessAccounts({ data: { businessId: business.id } }),
        loaders.businessAccountBalances({ data: { businessId: business.id } }),
      ]);
      qc.setQueryData(["business", business.id], detail);
      qc.setQueryData(["members", business.id], members);
      qc.setQueryData(["tasks", business.id, weekStart], tasks);
      qc.setQueryData(["btx", business.id], transactions);
      qc.setQueryData(["baccountsList", business.id], accountList);
      qc.setQueryData(["baccounts", business.id], balances);
    }),
  );

  report("Downloading personal finances", 4);
  await Promise.all(
    profiles.slice(0, OFFLINE_BOUNDS.MAX_PERSONAL_PROFILES).map(async (profile) => {
      const [detail, transactions, accounts, categories, counterparties, loans, budgets] =
        await Promise.all([
          loaders.getPersonalProfile({ data: { id: profile.id } }),
          loaders.listPersonalTransactions({ data: { profileId: profile.id } }),
          loaders.listPersonalAccounts({ data: { profileId: profile.id } }),
          loaders.listPersonalCategories({ data: { profileId: profile.id } }),
          loaders.listPersonalCounterparties({ data: { profileId: profile.id } }),
          loaders.listPersonalLoans({ data: { profileId: profile.id } }),
          loaders.listPersonalBudgets({ data: { profileId: profile.id } }),
        ]);
      qc.setQueryData(["personal", profile.id], detail);
      qc.setQueryData(["personal-tx", profile.id], transactions);
      qc.setQueryData(["personal-accts", profile.id], accounts);
      qc.setQueryData(["personal-cats", profile.id], categories);
      qc.setQueryData(["personal-cps", profile.id], counterparties);
      qc.setQueryData(["personal-loans", profile.id], loans);
      qc.setQueryData(["personal-budgets", profile.id], budgets);
    }),
  );

  report("Saving on this device", 5);
  await persistQueryCacheNow(qc);
  report("Available offline", 6);

  return {
    queryCount: qc
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.status === "success").length,
    businesses: businesses.length,
    profiles: profiles.length,
    conversations: conversations.length,
    savedAt: Date.now(),
  };
}

async function doWarmup(
  qc: QueryClient,
  loaders: OfflineLoaders,
  onProgress?: (progress: OfflineDownloadProgress) => void,
): Promise<void> {
  if (!onlineManager.isOnline()) return;
  const report = (phase: string, completed: number) =>
    onProgress?.({ phase, completed, total: DOWNLOAD_PHASES });

  const today = localToday();
  const weekStart = startOfWeekISO();

  // Top-level core set — fan out in parallel.
  report("Downloading core lists", 0);
  await Promise.all([
    safe(
      qc.prefetchQuery({
        queryKey: ["businesses"],
        queryFn: () => loaders.listBusinesses(),
        staleTime: FIVE_MIN,
      }),
    ),
    safe(
      qc.prefetchQuery({
        queryKey: ["my-tasks"],
        queryFn: () => loaders.listMyTasks(),
        staleTime: FIVE_MIN,
      }),
    ),
    safe(
      qc.prefetchQuery({
        queryKey: ["notebook", "lists"],
        queryFn: () => loaders.listNotebookLists(),
        staleTime: FIVE_MIN,
      }),
    ),
    safe(
      qc.prefetchQuery({
        queryKey: ["personal"],
        queryFn: () => loaders.listPersonalProfiles(),
        staleTime: FIVE_MIN,
      }),
    ),
    safe(
      qc.prefetchQuery({
        queryKey: ["notebook", "today", today],
        queryFn: () =>
          loaders.listTodos({
            data: { from: today, to: today, includeOverdue: true, includeUnscheduled: true },
          }),
        staleTime: FIVE_MIN,
      }),
    ),
    safe(
      qc.prefetchQuery({
        queryKey: ["chat", "unread-total"],
        queryFn: () => loaders.unreadTotal(),
        staleTime: FIVE_MIN,
      }),
    ),
    safe(
      qc.prefetchQuery({
        queryKey: ["chat", "conversations"],
        queryFn: () => loaders.listConversations(),
        staleTime: FIVE_MIN,
      }),
    ),
  ]);

  report("Downloading recent conversations", 1);
  const conversations =
    (qc.getQueryData(["chat", "conversations"]) as Array<{ id: string }> | undefined) ?? [];
  await Promise.all(
    conversations.slice(0, OFFLINE_BOUNDS.MAX_CONVERSATIONS).flatMap((conversation) => [
      safe(
        qc.prefetchQuery({
          queryKey: ["chat", "conv", conversation.id],
          queryFn: () => loaders.getConversation({ data: { conversationId: conversation.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["chat", "messages", conversation.id],
          queryFn: () =>
            loaders.listMessages({ data: { conversationId: conversation.id, limit: 100 } }),
          staleTime: FIVE_MIN,
        }),
      ),
    ]),
  );

  // Notebook: prefetch notes per list (component key: ["notebook","notes",listId]).
  report("Downloading notebook", 2);
  const lists = (qc.getQueryData(["notebook", "lists"]) as Array<{ id: string }> | undefined) ?? [];
  await Promise.all(
    lists.slice(0, OFFLINE_BOUNDS.MAX_LISTS).map(async (l) => {
      await safe(
        qc.prefetchQuery({
          queryKey: ["notebook", "notes", l.id],
          queryFn: () => loaders.listNotes({ data: { listId: l.id } }),
          staleTime: FIVE_MIN,
        }),
      );
      await safe(
        qc.prefetchQuery({
          queryKey: ["notebook", "list-todos", l.id],
          queryFn: () => loaders.listTodos({ data: { listId: l.id, includeUnscheduled: true } }),
          staleTime: FIVE_MIN,
        }),
      );
      const notes =
        (qc.getQueryData(["notebook", "notes", l.id]) as Array<{ id: string }> | undefined) ?? [];
      notes.forEach((note) => qc.setQueryData(["notebook", "note", note.id], note));
    }),
  );

  // Businesses: detail + members + this week's tasks + transactions per business.
  // Keys must match component call-sites:
  //   detail   -> ["business", id]
  //   members  -> ["members", id]
  //   tasks    -> ["tasks", id, weekStart]
  //   tx       -> ["btx", id]
  report("Downloading businesses", 3);
  const biz = (qc.getQueryData(["businesses"]) as Array<{ id: string }> | undefined) ?? [];
  await Promise.all(
    biz.slice(0, OFFLINE_BOUNDS.MAX_BUSINESSES).flatMap((b) => [
      safe(
        qc.prefetchQuery({
          queryKey: ["business", b.id],
          queryFn: () => loaders.getBusiness({ data: { id: b.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["members", b.id],
          queryFn: () => loaders.listMembers({ data: { businessId: b.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["tasks", b.id, weekStart],
          queryFn: () => loaders.listBusinessTasks({ data: { businessId: b.id, weekStart } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["btx", b.id],
          queryFn: () => loaders.listTransactions({ data: { businessId: b.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["baccountsList", b.id],
          queryFn: () => loaders.listBusinessAccounts({ data: { businessId: b.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["baccounts", b.id],
          queryFn: () => loaders.businessAccountBalances({ data: { businessId: b.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
    ]),
  );

  // Personal profiles: detail + accounts + categories + counterparties + loans
  // + budgets + recent tx. Keys must match component call-sites:
  //   detail    -> ["personal", id]
  //   tx        -> ["personal-tx", id]
  //   accts     -> ["personal-accts", id]
  //   cats      -> ["personal-cats", id]
  //   cps       -> ["personal-cps", id]
  //   loans     -> ["personal-loans", id]
  //   budgets   -> ["personal-budgets", id]
  report("Downloading personal finances", 4);
  const profs = (qc.getQueryData(["personal"]) as Array<{ id: string }> | undefined) ?? [];
  await Promise.all(
    profs.slice(0, OFFLINE_BOUNDS.MAX_PERSONAL_PROFILES).flatMap((p) => [
      safe(
        qc.prefetchQuery({
          queryKey: ["personal", p.id],
          queryFn: () => loaders.getPersonalProfile({ data: { id: p.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["personal-tx", p.id],
          queryFn: () => loaders.listPersonalTransactions({ data: { profileId: p.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["personal-accts", p.id],
          queryFn: () => loaders.listPersonalAccounts({ data: { profileId: p.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["personal-cats", p.id],
          queryFn: () => loaders.listPersonalCategories({ data: { profileId: p.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["personal-cps", p.id],
          queryFn: () => loaders.listPersonalCounterparties({ data: { profileId: p.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["personal-loans", p.id],
          queryFn: () => loaders.listPersonalLoans({ data: { profileId: p.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
      safe(
        qc.prefetchQuery({
          queryKey: ["personal-budgets", p.id],
          queryFn: () => loaders.listPersonalBudgets({ data: { profileId: p.id } }),
          staleTime: FIVE_MIN,
        }),
      ),
    ]),
  );

  report("Saving on this device", 5);
  await persistQueryCacheNow(qc);
  report("Available offline", 6);
}
