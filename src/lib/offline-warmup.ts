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

import type { QueryClient } from "@tanstack/react-query";
import {
  listBusinessesFn,
  myTasksFn,
  listPersonalProfilesFn,
  listMembersFn,
  listBusinessTasksFn,
  listTransactionsFn,
  listPersonalAccountsFn,
  listPersonalCategoriesFn,
  listPersonalCounterpartiesFn,
  listPersonalLoansFn,
  listPersonalBudgetsFn,
  listPersonalTxExFn,
  getBusinessFn,
  getPersonalProfileFn,
  listBusinessAccountsFn,
  businessAccountBalancesFn,
} from "@/lib/zt.functions";
import { listListsFn, listNotesFn, listTodosFn } from "@/lib/notebook.functions";
import { unreadTotalFn } from "@/lib/chat.functions";

import { OFFLINE_BOUNDS } from "@/lib/offline-manifest";
const FIVE_MIN = OFFLINE_BOUNDS.STALE_TIME_MS;

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
  try { return await p; } catch { return null; }
}

let warmupInFlight: Promise<void> | null = null;

export function runOfflineWarmup(qc: QueryClient): Promise<void> {
  if (warmupInFlight) return warmupInFlight;
  warmupInFlight = doWarmup(qc).finally(() => { warmupInFlight = null; });
  return warmupInFlight;
}

async function doWarmup(qc: QueryClient): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const today = localToday();
  const weekStart = startOfWeekISO();

  // Top-level core set — fan out in parallel.
  await Promise.all([
    safe(qc.prefetchQuery({ queryKey: ["businesses"], queryFn: () => listBusinessesFn(), staleTime: FIVE_MIN })),
    safe(qc.prefetchQuery({ queryKey: ["my-tasks"], queryFn: () => myTasksFn(), staleTime: FIVE_MIN })),
    safe(qc.prefetchQuery({ queryKey: ["notebook", "lists"], queryFn: () => listListsFn(), staleTime: FIVE_MIN })),
    safe(qc.prefetchQuery({ queryKey: ["personal"], queryFn: () => listPersonalProfilesFn(), staleTime: FIVE_MIN })),
    safe(qc.prefetchQuery({
      queryKey: ["notebook", "today", today],
      queryFn: () => listTodosFn({ data: { from: today, to: today, includeOverdue: true, includeUnscheduled: true } }),
      staleTime: FIVE_MIN,
    })),
    safe(qc.prefetchQuery({ queryKey: ["chat", "unread-total"], queryFn: () => unreadTotalFn(), staleTime: FIVE_MIN })),
  ]);

  // Notebook: prefetch notes per list (component key: ["notebook","notes",listId]).
  const lists = (qc.getQueryData(["notebook", "lists"]) as Array<{ id: string }> | undefined) ?? [];
  await Promise.all(
    lists.slice(0, OFFLINE_BOUNDS.MAX_LISTS).map(async (l) => {
      await safe(qc.prefetchQuery({
        queryKey: ["notebook", "notes", l.id],
        queryFn: () => listNotesFn({ data: { listId: l.id } }),
        staleTime: FIVE_MIN,
      }));
      await safe(qc.prefetchQuery({
        queryKey: ["notebook", "list-todos", l.id],
        queryFn: () => listTodosFn({ data: { listId: l.id, includeUnscheduled: true } }),
        staleTime: FIVE_MIN,
      }));
      const notes = (qc.getQueryData(["notebook", "notes", l.id]) as Array<{ id: string }> | undefined) ?? [];
      notes.forEach((note) => qc.setQueryData(["notebook", "note", note.id], note));
    }),
  );

  // Businesses: detail + members + this week's tasks + transactions per business.
  // Keys must match component call-sites:
  //   detail   -> ["business", id]
  //   members  -> ["members", id]
  //   tasks    -> ["tasks", id, weekStart]
  //   tx       -> ["btx", id]
  const biz = (qc.getQueryData(["businesses"]) as Array<{ id: string }> | undefined) ?? [];
  await Promise.all(
    biz.slice(0, OFFLINE_BOUNDS.MAX_BUSINESSES).flatMap((b) => [
      safe(qc.prefetchQuery({
        queryKey: ["business", b.id],
        queryFn: () => getBusinessFn({ data: { id: b.id } }),
        staleTime: FIVE_MIN,
      })),
      safe(qc.prefetchQuery({
        queryKey: ["members", b.id],
        queryFn: () => listMembersFn({ data: { businessId: b.id } }),
        staleTime: FIVE_MIN,
      })),
      safe(qc.prefetchQuery({
        queryKey: ["tasks", b.id, weekStart],
        queryFn: () => listBusinessTasksFn({ data: { businessId: b.id, weekStart } }),
        staleTime: FIVE_MIN,
      })),
      safe(qc.prefetchQuery({
        queryKey: ["btx", b.id],
        queryFn: () => listTransactionsFn({ data: { businessId: b.id } }),
        staleTime: FIVE_MIN,
      })),
      safe(qc.prefetchQuery({
        queryKey: ["baccountsList", b.id],
        queryFn: () => listBusinessAccountsFn({ data: { businessId: b.id } }),
        staleTime: FIVE_MIN,
      })),
      safe(qc.prefetchQuery({
        queryKey: ["baccounts", b.id],
        queryFn: () => businessAccountBalancesFn({ data: { businessId: b.id } }),
        staleTime: FIVE_MIN,
      })),
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
  const profs = (qc.getQueryData(["personal"]) as Array<{ id: string }> | undefined) ?? [];
  await Promise.all(
    profs.slice(0, OFFLINE_BOUNDS.MAX_PERSONAL_PROFILES).flatMap((p) => [
      safe(qc.prefetchQuery({ queryKey: ["personal", p.id], queryFn: () => getPersonalProfileFn({ data: { id: p.id } }), staleTime: FIVE_MIN })),
      safe(qc.prefetchQuery({ queryKey: ["personal-tx", p.id], queryFn: () => listPersonalTxExFn({ data: { profileId: p.id } }), staleTime: FIVE_MIN })),
      safe(qc.prefetchQuery({ queryKey: ["personal-accts", p.id], queryFn: () => listPersonalAccountsFn({ data: { profileId: p.id } }), staleTime: FIVE_MIN })),
      safe(qc.prefetchQuery({ queryKey: ["personal-cats", p.id], queryFn: () => listPersonalCategoriesFn({ data: { profileId: p.id } }), staleTime: FIVE_MIN })),
      safe(qc.prefetchQuery({ queryKey: ["personal-cps", p.id], queryFn: () => listPersonalCounterpartiesFn({ data: { profileId: p.id } }), staleTime: FIVE_MIN })),
      safe(qc.prefetchQuery({ queryKey: ["personal-loans", p.id], queryFn: () => listPersonalLoansFn({ data: { profileId: p.id } }), staleTime: FIVE_MIN })),
      safe(qc.prefetchQuery({ queryKey: ["personal-budgets", p.id], queryFn: () => listPersonalBudgetsFn({ data: { profileId: p.id } }), staleTime: FIVE_MIN })),
    ]),
  );
}
