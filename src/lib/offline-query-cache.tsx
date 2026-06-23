import { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useMemo, type ReactNode } from "react";

const QUERY_CACHE_KEY = "zs:query-cache:v1";
const MAX_AGE = 1000 * 60 * 60 * 24 * 30;

export function OfflineQueryProvider({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  if (typeof window === "undefined") {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  // Memoize so we don't re-instantiate a persister on every render — that
  // would trigger redundant cache (de)serialization and dehydration races.
  const persistOptions = useMemo(
    () => ({
      persister: createSyncStoragePersister({
        storage: window.localStorage,
        key: QUERY_CACHE_KEY,
        throttleTime: 1000,
      }),
      maxAge: MAX_AGE,
      dehydrateOptions: {
        shouldDehydrateQuery: (query: { state: { status: string } }) =>
          query.state.status === "success",
      },
    }),
    [],
  );

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
