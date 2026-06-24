import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

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
    defaultPreloadStaleTime: 0,
  });

  return router;
};
