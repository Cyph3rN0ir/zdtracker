import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
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
import { getFailedQueueSize, getQueueSize, subscribeQueue } from "@/lib/offline-queue";

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
      <PersistGate queryClient={queryClient} persistOptions={persistOptions}>
        {children}
      </PersistGate>
    </OfflineStatusProvider>
  );
}

/**
 * Tracks the "restoring" status while `PersistQueryClientProvider` hydrates
 * the IndexedDB cache. Must live INSIDE `OfflineStatusProvider` (so it can
 * use the context) and AROUND `PersistQueryClientProvider` (so it can mark
 * restoring=true before restore starts and flip it false in `onSuccess`).
 */
function PersistGate({
  queryClient,
  persistOptions,
  children,
}: {
  queryClient: QueryClient;
  persistOptions: NonNullable<ReturnType<typeof buildPersistOptionsType>>;
  children: ReactNode;
}) {
  const { setRestoring } = useOfflineStatus();
  useEffect(() => {
    setRestoring(true);
    return () => setRestoring(false);
  }, [setRestoring]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => {
        setRestoring(false);
        if (onlineManager.isOnline()) {
          queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
        }
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

// Type-only helper so PersistGate can borrow the inferred persistOptions shape
// without exporting a duplicate type. Never called.
declare function buildPersistOptionsType(): {
  persister: ReturnType<typeof createQueryPersister>;
  maxAge: number;
  buster: string;
  dehydrateOptions: { shouldDehydrateQuery: (q: { state: { status: string } }) => boolean };
};

/**
 * Single unified offline status pill (replaces the old `OfflineBanner` +
 * `OfflineIndicator` duplication). Reads exclusively from the shared
 * `OfflineStatusProvider`.
 */
export function OfflineBanner() {
  const { status } = useOfflineStatus();
  const pending = useSyncExternalStore(subscribeQueue, getQueueSize, () => 0);
  const failed = useSyncExternalStore(subscribeQueue, getFailedQueueSize, () => 0);

  if ((status === "online" && pending === 0) || status === "restoring") return null;

  // Monochrome surface, accent comes only from a tiny status dot — keeps the
  // pill professional and unobtrusive while still readable on any background.
  const dot =
    failed > 0
      ? "bg-rose-400"
      : status === "offline"
      ? "bg-amber-400"
      : status === "sync-failed"
        ? "bg-rose-400"
        : "bg-emerald-400"; // syncing / back online

  const pulse = status === "syncing" || status === "sync-failed" || failed > 0 ? false : true;
  const spin = status === "syncing";

  const label =
    failed > 0
      ? "Sync needs attention"
      : status === "offline"
      ? "Offline"
      : status === "syncing"
        ? "Syncing…"
        : status === "sync-failed"
          ? "Sync failed"
          : "Back online";

  const sub =
    failed > 0
      ? "Will retry automatically"
      : status === "offline"
      ? "Showing last synced data"
      : status === "syncing"
        ? "Updating in background"
        : status === "sync-failed"
          ? "Will retry automatically"
          : "Catching up";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${label} — ${sub}`}
      className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] mx-auto flex w-fit max-w-[92vw] items-center gap-2.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {pulse && (
          <span
            className={
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 " +
              dot
            }
          />
        )}
        {spin ? (
          <span className="h-2 w-2 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
        ) : (
          <span className={"relative inline-flex h-2 w-2 rounded-full " + dot} />
        )}
      </span>
      <span className="font-medium text-foreground tracking-tight">{label}</span>
      {pending > 0 && <span className="text-muted-foreground">{pending} pending</span>}
      <span className="hidden sm:inline text-muted-foreground">·</span>
      <span className="hidden sm:inline text-muted-foreground">{sub}</span>
    </div>
  );
}

// Re-export for callers that want the raw onlineManager.
export { onlineManager };
