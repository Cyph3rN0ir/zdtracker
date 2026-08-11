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
  await qc.invalidateQueries({ refetchType: "none" });
  await doWarmup(qc, loaders, onProgress);

  const requiredSections = [
    { label: "businesses", key: ["businesses"] },
    { label: "tasks", key: ["my-tasks"] },
    { label: "personal profiles", key: ["personal"] },
    { label: "notebook", key: ["notebook", "lists"] },
    { label: "conversations", key: ["chat", "conversations"] },
  ];
  const missing = requiredSections.filter(({ key }) => qc.getQueryData(key) === undefined);
  if (missing.length > 0) {
    const firstError = missing
      .map(({ key }) => qc.getQueryState(key)?.error)
      .find((error): error is Error => error instanceof Error);
    const sectionNames = missing.map(({ label }) => label).join(", ");
    throw new Error(
      `Could not download: ${sectionNames}${firstError ? `. ${firstError.message}` : ""}`,
    );
  }

  return {
    queryCount: qc
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.status === "success").length,
    businesses: ((qc.getQueryData(["businesses"]) as unknown[]) ?? []).length,
    profiles: ((qc.getQueryData(["personal"]) as unknown[]) ?? []).length,
    conversations: ((qc.getQueryData(["chat", "conversations"]) as unknown[]) ?? []).length,
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
