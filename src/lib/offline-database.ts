import { hydrate, type DehydratedState, type QueryClient } from "@tanstack/react-query";
import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { readCachedMe } from "@/lib/cached-session";
import { dehydrateOfflineQueries } from "@/lib/query-snapshot";

const DATABASE_VERSION = 1;
const DATABASE_PREFIX = "zs:offline-database:v1:";

type OfflineDatabase = {
  version: number;
  userId: string;
  savedAt: number;
  state: DehydratedState;
};

const restoredForClient = new WeakMap<QueryClient, string>();

function databaseKey(userId: string): string {
  return `${DATABASE_PREFIX}${userId}`;
}

export function hasDownloadedOfflineData(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(`zs:offline-download-meta:v1:${userId}`);
    if (!raw) return false;
    const meta = JSON.parse(raw) as { savedAt?: number; queryCount?: number };
    return Number(meta.savedAt) > 0 && Number(meta.queryCount) > 0;
  } catch {
    return false;
  }
}

export async function restoreOfflineDatabase(queryClient: QueryClient): Promise<number> {
  if (typeof window === "undefined") return 0;
  const me = readCachedMe();
  if (!me) return 0;
  if (restoredForClient.get(queryClient) === me.userId) return 0;
  try {
    const stored = await idbGet<OfflineDatabase>(databaseKey(me.userId));
    restoredForClient.set(queryClient, me.userId);
    if (
      !stored ||
      stored.version !== DATABASE_VERSION ||
      stored.userId !== me.userId ||
      !stored.state
    ) {
      return 0;
    }
    hydrate(queryClient, stored.state);
    return stored.state.queries.length;
  } catch {
    return 0;
  }
}

export async function saveOfflineDatabase(queryClient: QueryClient): Promise<number> {
  if (typeof window === "undefined") return 0;
  const me = readCachedMe();
  if (!me) return 0;
  const state = dehydrateOfflineQueries(queryClient);
  if (state.queries.length === 0) return 0;
  const stored: OfflineDatabase = {
    version: DATABASE_VERSION,
    userId: me.userId,
    savedAt: Date.now(),
    state,
  };
  try {
    await idbSet(databaseKey(me.userId), stored);
    window.localStorage.setItem(
      `zs:offline-download-meta:v1:${me.userId}`,
      JSON.stringify({ savedAt: stored.savedAt, queryCount: state.queries.length }),
    );
    restoredForClient.set(queryClient, me.userId);
    return state.queries.length;
  } catch {
    return 0;
  }
}

export async function purgeOfflineDatabases(userId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (userId) {
    await idbDel(databaseKey(userId)).catch(() => undefined);
    try {
      window.localStorage.removeItem(`zs:offline-download-meta:v1:${userId}`);
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
    return;
  }
  const ids = new Set<string>();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("zs:offline-download-meta:v1:")) {
        ids.add(key.slice("zs:offline-download-meta:v1:".length));
      }
    }
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
  await Promise.all(Array.from(ids, (id) => idbDel(databaseKey(id)).catch(() => undefined)));
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("zs:offline-download-meta:v1:")) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}
