// IndexedDB-backed React Query persister.
//
// Phase 1 of the offline plan: extracted from offline-query-cache.tsx so the
// persister, key, and purge logic live in one place and can be reused (e.g.
// by sign-out hygiene, account switching, future cache busters).

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import type { QueryClient } from "@tanstack/react-query";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { purgeQuerySnapshot, saveQuerySnapshot } from "@/lib/query-snapshot";
import { purgeOfflineDatabases, saveOfflineDatabase } from "@/lib/offline-database";

// Bump when the shape of persisted query data changes in a breaking way.
export const QUERY_CACHE_KEY = "zs:query-cache:v2";

// 30 days — long enough for "I open the app once a month" usage.
export const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

// Build-tagged so a new deploy invalidates stale cache shapes automatically.
export const QUERY_CACHE_BUSTER = String(import.meta.env?.VITE_BUILD_ID ?? "1");

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

// The provider persists reactively, but Android may be backgrounded or killed
// before its throttled write runs. Warmup calls this explicit checkpoint once
// the core data set has finished loading.
export async function persistQueryCacheNow(queryClient: QueryClient): Promise<void> {
  const snapshotSaved = saveQuerySnapshot(queryClient);
  const databaseQueryCount = await saveOfflineDatabase(queryClient);
  type PersistQueryClient = Parameters<typeof persistQueryClientSave>[0]["queryClient"];
  try {
    await persistQueryClientSave({
      // The installed persistence adapter trails React Query by one patch
      // release; their runtime QueryClient contract is compatible.
      queryClient: queryClient as unknown as PersistQueryClient,
      persister: createQueryPersister(),
      buster: QUERY_CACHE_BUSTER,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.state.status === "success",
      },
    });
  } catch {
    // IndexedDB is the larger secondary cache. The synchronous snapshot is
    // deliberately sufficient by itself on Android WebViews where IDB restore
    // has proven unreliable.
  }
  if (!snapshotSaved && databaseQueryCount === 0) {
    throw new Error("Offline data could not be saved on this device");
  }
  try {
    window.localStorage.setItem("zs:offline-data-ready:v1", String(Date.now()));
  } catch {
    // The snapshot itself is authoritative; this legacy marker is optional.
  }
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
