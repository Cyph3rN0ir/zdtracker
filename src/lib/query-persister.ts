// IndexedDB-backed React Query persister.
//
// Phase 1 of the offline plan: extracted from offline-query-cache.tsx so the
// persister, key, and purge logic live in one place and can be reused (e.g.
// by sign-out hygiene, account switching, future cache busters).

import type { QueryClient } from "@tanstack/react-query";
import { del as idbDel } from "idb-keyval";
import {
  dehydrateOfflineQueries,
  purgeQuerySnapshot,
  saveQuerySnapshot,
} from "@/lib/query-snapshot";
import { purgeOfflineDatabases, saveOfflineDatabase } from "@/lib/offline-database";

// Bump when the shape of persisted query data changes in a breaking way.
export const QUERY_CACHE_KEY = "zs:query-cache:v2";

// 30 days — long enough for "I open the app once a month" usage.
export async function persistQueryCacheNow(queryClient: QueryClient): Promise<number> {
  const checkpointQueryCount = dehydrateOfflineQueries(queryClient).queries.length;
  const snapshotSaved = saveQuerySnapshot(queryClient);
  const databaseQueryCount = await saveOfflineDatabase(queryClient);
  if (!snapshotSaved && databaseQueryCount === 0) {
    throw new Error("Offline data could not be saved on this device");
  }
  try {
    window.localStorage.setItem("zs:offline-data-ready:v1", String(Date.now()));
  } catch {
    // The snapshot itself is authoritative; this legacy marker is optional.
  }
  return Math.max(databaseQueryCount, snapshotSaved ? checkpointQueryCount : 0);
}

// Hard-purge the persisted cache. Safe to call on sign-out / user switch.
export async function purgePersistedQueryCache(): Promise<void> {
  purgeQuerySnapshot();
  await purgeOfflineDatabases();
  try {
    await idbDel(QUERY_CACHE_KEY);
  } catch {
    // If IndexedDB is unavailable (Safari private mode, quota), there is
    // nothing to purge.
  }
}
