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


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route code + loader data when a link enters the viewport, so
    // visible nav items are warm by the time the user taps. Intent (hover/
    // focus) is implicit fallback for off-screen links.
    defaultPreload: "viewport",
    defaultPreloadDelay: 50,
    // Query owns freshness; let preload always re-check.
    defaultPreloadStaleTime: 0,
    // Show a skeleton instead of a blank flash when a route's loader takes
    // longer than 200ms. Cached routes resolve faster than that and skip it.
    defaultPendingMs: 200,
    defaultPendingMinMs: 0,
    defaultPendingComponent: RouteSkeleton,
  });

  return router;
};
