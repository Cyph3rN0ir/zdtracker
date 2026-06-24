// IndexedDB-backed React Query persister.
//
// Phase 1 of the offline plan: extracted from offline-query-cache.tsx so the
// persister, key, and purge logic live in one place and can be reused (e.g.
// by sign-out hygiene, account switching, future cache busters).

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

// Bump when the shape of persisted query data changes in a breaking way.
export const QUERY_CACHE_KEY = "zs:query-cache:v2";

// 30 days — long enough for "I open the app once a month" usage.
export const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

// Build-tagged so a new deploy invalidates stale cache shapes automatically.
export const QUERY_CACHE_BUSTER = String(
  (import.meta as any).env?.VITE_BUILD_ID ?? "1",
);

export function createQueryPersister() {
  return createAsyncStoragePersister({
    storage: {
      getItem: (key) => idbGet<string>(key).then((v) => v ?? null),
      setItem: (key, value) => idbSet(key, value),
      removeItem: (key) => idbDel(key),
    },
    key: QUERY_CACHE_KEY,
    throttleTime: 1000,
  });
}

// Hard-purge the persisted cache. Safe to call on sign-out / user switch.
export async function purgePersistedQueryCache(): Promise<void> {
  try {
    await idbDel(QUERY_CACHE_KEY);
  } catch {
    // If IndexedDB is unavailable (Safari private mode, quota), there is
    // nothing to purge.
  }
}
