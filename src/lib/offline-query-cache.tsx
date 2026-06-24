import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, useMemo, type ReactNode } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { shouldDisablePwaFeatures } from "@/lib/pwa-host-guard";
import {
  createQueryPersister,
  purgePersistedQueryCache,
  QUERY_CACHE_MAX_AGE,
  QUERY_CACHE_BUSTER,
} from "@/lib/query-persister";
import {
  OfflineStatusProvider,
  useOfflineStatus,
} from "@/lib/offline-status";

/**
 * Top-level offline provider:
 *
 * 1. Wraps the QueryClient in either a passthrough provider (preview/dev/
 *    iframe/SSR) or a `PersistQueryClientProvider` that rehydrates from
 *    IndexedDB on launch.
 * 2. Wraps everything in `OfflineStatusProvider` so the whole app reads
 *    the same online/restoring/syncing/offline status.
 * 3. Purges the persisted cache on sign-out so the next user can't see
 *    the previous user's data.
 */
export function OfflineQueryProvider({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  const skip = shouldDisablePwaFeatures();

  const persistOptions = useMemo(() => {
    if (skip) return null;
    return {
      persister: createQueryPersister(),
      maxAge: QUERY_CACHE_MAX_AGE,
      buster: QUERY_CACHE_BUSTER,
      dehydrateOptions: {
        shouldDehydrateQuery: (query: { state: { status: string } }) =>
          query.state.status === "success",
      },
    };
  }, [skip]);

  useEffect(() => {
    if (skip) return;
    const { data: sub } = getSupabaseBrowser().auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        purgePersistedQueryCache();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [skip, queryClient]);

  if (!persistOptions) {
    return (
      <OfflineStatusProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </OfflineStatusProvider>
    );
  }

  return (
    <OfflineStatusProvider>
      <RestoringStatusBridge>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          onSuccess={() => {
            if (typeof navigator === "undefined" || navigator.onLine) {
              queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
            }
          }}
        >
          {children}
        </PersistQueryClientProvider>
      </RestoringStatusBridge>
    </OfflineStatusProvider>
  );
}

/**
 * Marks the status as "restoring" while the persisted Query cache hydrates.
 * `PersistQueryClientProvider` already blocks rendering of its children until
 * restore finishes, but consumers of the offline status (banner, future
 * skeletons) need a flag they can read.
 */
function RestoringStatusBridge({ children }: { children: ReactNode }) {
  const { setRestoring } = useOfflineStatus();
  useEffect(() => {
    setRestoring(true);
    // Microtask: PersistQueryClientProvider will block its subtree until the
    // persister resolves; this effect runs once that subtree mounts, so we
    // immediately clear the flag.
    const id = window.setTimeout(() => setRestoring(false), 0);
    return () => window.clearTimeout(id);
  }, [setRestoring]);
  return <>{children}</>;
}

/**
 * Single unified offline status pill (replaces the old `OfflineBanner` +
 * `OfflineIndicator` duplication). Reads exclusively from the shared
 * `OfflineStatusProvider`.
 */
export function OfflineBanner() {
  const { status } = useOfflineStatus();

  if (status === "online" || status === "restoring") return null;

  const tone =
    status === "offline"
      ? "bg-amber-500/95 text-amber-950"
      : status === "sync-failed"
        ? "bg-rose-500/95 text-rose-950"
        : "bg-emerald-500/95 text-emerald-950";

  const label =
    status === "offline"
      ? "Offline — showing last synced data"
      : status === "syncing"
        ? "Syncing offline data…"
        : status === "sync-failed"
          ? "Some data couldn't sync"
          : "Back online — syncing";

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "fixed inset-x-0 bottom-3 z-[60] mx-auto w-fit max-w-[92vw] rounded-full px-3.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur " +
        tone
      }
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {label}
    </div>
  );
}

// Re-export for callers that want the raw onlineManager.
export { onlineManager };
