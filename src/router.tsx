import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteSkeleton } from "./components/RouteSkeleton";
import {
  installQuerySnapshotPersistence,
  restoreQuerySnapshot,
} from "./lib/query-snapshot";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24 * 30,
        // Server functions are deliberately not service-worker cached. Pause
        // them while disconnected and render the restored query data instead.
        networkMode: "online",
        // keepPreviousData: when the queryKey changes (e.g. navigating between
        // /notebook/lists/$listId entries), keep showing the previous result
        // while the next one loads — no "Network Error" flash on slow links
        // and instant render from the IndexedDB-persisted cache.
        placeholderData: keepPreviousData,
        retry: (failureCount, error: any) => {
          // Don't retry permanent errors (auth / not found / validation)
          const msg = String(error?.message ?? "").toLowerCase();
          if (msg.includes("not found") || msg.includes("unauthorized") || msg.includes("forbidden")) return false;
          return failureCount < 3;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        // 5 min: navigation reuses cached data immediately without a refetch
        // flicker. Mutations still invalidate explicitly when data changes.
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });

  // Android needs cached data before route components mount. IndexedDB
  // restoration remains the larger secondary cache, while this bounded
  // local snapshot hydrates synchronously during router construction.
  restoreQuerySnapshot(queryClient);
  installQuerySnapshotPersistence(queryClient);


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload on interaction intent. Viewport preloading caused every item in
    // the mobile navigation drawer to start route loaders together, including
    // while offline, which made ordinary taps contend with unnecessary work.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Query owns freshness; let preload always re-check.
    defaultPreloadStaleTime: 0,
    // Show a skeleton instead of a blank flash when a route's loader takes
    // longer than 200ms. Cached routes resolve faster than that and skip it.
    defaultPendingMs: 200,
    defaultPendingMinMs: 0,
    defaultPendingComponent: RouteSkeleton,
    // Android WebView can retain large old route layers during offline view
    // transitions. Normal React swaps are faster and avoid those stalls.
    defaultViewTransition: false,
  });

  return router;
};
