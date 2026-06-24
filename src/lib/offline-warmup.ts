// Phase 2: proactive offline warmup.
//
// After login, prefetch a "core working set" of queries into React Query's
// IndexedDB-persisted cache so that — even if the user has never opened those
// pages before this session — the data is available on a cold offline launch.
//
// This is intentionally bounded: we do not (and cannot) prefetch every
// possible per-id route. We prefetch:
//   - dashboard (businesses list)
//   - my tasks
//   - notebook lists
//   - notebook today (today's date)
//   - personal profiles list
//   - unread chat count
//   - per-business: members + recent tasks + recent transactions (last 30d)
//   - per-list: notes index
//   - per-personal-profile: accounts/categories
//
// Each prefetch uses `staleTime` long enough that it won't thrash on every
// render, but `prefetchQuery` will still re-fetch in the background when the
// data is stale on subsequent online visits.

import type { QueryClient } from "@tanstack/react-query";
import { listBusinessesFn, myTasksFn, listPersonalProfilesFn, listMembersFn, listBusinessTasksFn, listTransactionsFn, listPersonalAccountsFn, listPersonalCategoriesFn } from "@/lib/zt.functions";
import { listListsFn, listNotesFn, listTodosFn } from "@/lib/notebook.functions";
import { unreadTotalFn } from "@/lib/chat.functions";

const FIVE_MIN = 1000 * 60 * 5;

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export async function runOfflineWarmup(qc: QueryClient): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const today = localToday();

  // Top-level core set — fire in parallel.
  const [businesses, , , profiles] = await Promise.all([
    safe(qc.fetchQuery({ queryKey: ["businesses"], queryFn: () => listBusinessesFn(), staleTime: FIVE_MIN })),
    safe(qc.fetchQuery({ queryKey: ["my-tasks"], queryFn: () => myTasksFn(), staleTime: FIVE_MIN })),
    safe(qc.fetchQuery({ queryKey: ["notebook", "lists"], queryFn: () => listListsFn(), staleTime: FIVE_MIN })),
    safe(qc.fetchQuery({ queryKey: ["personal"], queryFn: () => listPersonalProfilesFn(), staleTime: FIVE_MIN })),
    safe(qc.fetchQuery({
      queryKey: ["notebook", "today", today],
      queryFn: () => listTodosFn({ data: { from: today, to: today, includeOverdue: true, includeUnscheduled: true } }),
      staleTime: FIVE_MIN,
    })),
    safe(qc.fetchQuery({ queryKey: ["chat", "unread-total"], queryFn: () => unreadTotalFn(), staleTime: FIVE_MIN })),
  ]);

  // Notebook: prefetch notes index per list.
  const lists = (qc.getQueryData(["notebook", "lists"]) as Array<{ id: string }> | undefined) ?? [];
  await Promise.all(
    lists.slice(0, 20).map((l) =>
      safe(qc.fetchQuery({
        queryKey: ["notebook", "notes", l.id],
        queryFn: () => listNotesFn({ data: { listId: l.id } }),
        staleTime: FIVE_MIN,
      })),
    ),
  );

  // Businesses: per-business members + tasks + recent transactions.
  const biz = (businesses as Array<{ id: string }> | null) ?? [];
  await Promise.all(
    biz.slice(0, 20).flatMap((b) => [
      safe(qc.fetchQuery({
        queryKey: ["business", b.id, "members"],
        queryFn: () => listMembersFn({ data: { businessId: b.id } }),
        staleTime: FIVE_MIN,
      })),
      safe(qc.fetchQuery({
        queryKey: ["business", b.id, "tasks"],
        queryFn: () => listBusinessTasksFn({ data: { businessId: b.id } }),
        staleTime: FIVE_MIN,
      })),
      safe(qc.fetchQuery({
        queryKey: ["business", b.id, "tx"],
        queryFn: () => listTransactionsFn({ data: { businessId: b.id } }),
        staleTime: FIVE_MIN,
      })),
    ]),
  );

  // Personal: per-profile accounts + categories.
  const profs = (profiles as Array<{ id: string }> | null) ?? [];
  await Promise.all(
    profs.slice(0, 20).flatMap((p) => [
      safe(qc.fetchQuery({
        queryKey: ["personal", p.id, "accounts"],
        queryFn: () => listPersonalAccountsFn({ data: { profileId: p.id } }),
        staleTime: FIVE_MIN,
      })),
      safe(qc.fetchQuery({
        queryKey: ["personal", p.id, "categories"],
        queryFn: () => listPersonalCategoriesFn({ data: { profileId: p.id } }),
        staleTime: FIVE_MIN,
      })),
    ]),
  );
}
