import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { readCachedMe } from "@/lib/cached-session";

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_PREFIX = "zs:query-snapshot:v1:";
const MAX_SNAPSHOT_CHARS = 3_500_000;

type StoredSnapshot = {
  version: number;
  userId: string;
  savedAt: number;
  state: DehydratedState;
};

function snapshotKey(userId: string): string {
  return `${SNAPSHOT_PREFIX}${userId}`;
}

function isOfflineQuery(queryKey: QueryKey): boolean {
  const root = String(queryKey[0] ?? "");
  if (
    root === "businesses" ||
    root === "business" ||
    root === "members" ||
    root === "tasks" ||
    root === "my-tasks" ||
    root === "btx" ||
    root.startsWith("baccounts") ||
    root === "personal" ||
    root.startsWith("personal-") ||
    root === "notebook"
  ) {
    return true;
  }
  if (root !== "chat") return false;
  return ["conversations", "conv", "messages", "unread-total"].includes(String(queryKey[1] ?? ""));
}

function trimState(state: DehydratedState): DehydratedState {
  return {
    ...state,
    queries: state.queries.map((query) => {
      const data = query.state.data;
      if (!Array.isArray(data)) return query;
      const root = String(query.queryKey[0] ?? "");
      const second = String(query.queryKey[1] ?? "");
      const limit = root === "chat" && second === "messages" ? 100 : 500;
      if (data.length <= limit) return query;
      return {
        ...query,
        state: {
          ...query.state,
          data:
            root === "chat" && second === "messages" ? data.slice(-limit) : data.slice(0, limit),
        },
      };
    }),
  };
}

export function restoreQuerySnapshot(queryClient: QueryClient): boolean {
  if (typeof window === "undefined") return false;
  const me = readCachedMe();
  if (!me) return false;
  try {
    const raw = window.localStorage.getItem(snapshotKey(me.userId));
    if (!raw) return false;
    const stored = JSON.parse(raw) as StoredSnapshot;
    if (stored.version !== SNAPSHOT_VERSION || stored.userId !== me.userId || !stored.state) {
      return false;
    }
    hydrate(queryClient, stored.state);
    return stored.state.queries.length > 0;
  } catch {
    return false;
  }
}

export function saveQuerySnapshot(queryClient: QueryClient): boolean {
  if (typeof window === "undefined") return false;
  const me = readCachedMe();
  if (!me) return false;
  try {
    const state = trimState(
      dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          query.state.status === "success" && isOfflineQuery(query.queryKey),
      }),
    );
    const payload: StoredSnapshot = {
      version: SNAPSHOT_VERSION,
      userId: me.userId,
      savedAt: Date.now(),
      state,
    };
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_SNAPSHOT_CHARS) return false;
    window.localStorage.setItem(snapshotKey(me.userId), serialized);
    window.localStorage.setItem("zs:offline-data-ready:v2", String(payload.savedAt));
    return state.queries.length > 0;
  } catch {
    return false;
  }
}

export function installQuerySnapshotPersistence(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event?.query.state.status !== "success") return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveQuerySnapshot(queryClient), 250);
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

export function purgeQuerySnapshot(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) window.localStorage.removeItem(snapshotKey(userId));
    else {
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(SNAPSHOT_PREFIX)) window.localStorage.removeItem(key);
      }
    }
    window.localStorage.removeItem("zs:offline-data-ready:v2");
  } catch {
    // Storage is best-effort and may be unavailable in restricted contexts.
  }
}
