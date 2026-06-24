import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteSkeleton } from "./components/RouteSkeleton";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24 * 30,
        // offlineFirst: when offline, queries serve cached data instead of erroring.
        networkMode: "offlineFirst",
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
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route code + loader data on link hover/focus so navigation
    // feels instant. 50ms delay avoids preloading on quick mouse-over.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Query owns freshness; let preload always re-check.
    defaultPreloadStaleTime: 0,
    // Keep the previous page mounted briefly so users don't see a blank
    // flash before the new route's loader resolves from cache.
    defaultPendingMs: 200,
    defaultPendingMinMs: 0,
  });

  return router;
};
