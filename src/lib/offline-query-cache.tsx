import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore, type ReactNode } from "react";
import { OfflineStatusProvider, useOfflineStatus } from "@/lib/offline-status";
import { getFailedQueueSize, getQueueSize, subscribeQueue } from "@/lib/offline-queue";
import { restoreQuerySnapshot } from "@/lib/query-snapshot";

/**
 * Top-level offline provider:
 *
 * 1. Wraps the shared QueryClient without starting a competing asynchronous
 *    restore. The router restores the user-scoped snapshot/database before
 *    child routes load.
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
  // TanStack Start completes its document hydration after getRouter() is
  // created. On a cold service-worker boot that hydration can replace the
  // queries restored during router construction. Re-apply the synchronous,
  // user-scoped checkpoint here, immediately before route components read
  // their queries. React Query's hydrate() keeps newer in-memory data, so
  // this is also safe during an ordinary online boot.
  restoreQuerySnapshot(queryClient);

  return (
    <OfflineStatusProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </OfflineStatusProvider>
  );
}

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
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 " + dot
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
