import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const QUERY_CACHE_KEY = "zs:query-cache:v2";
const MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days
const BUSTER = (import.meta as any).env?.VITE_BUILD_ID ?? "1";

const PREVIEW_HOST_SUFFIXES = [
  ".lovableproject.com",
  ".lovableproject-dev.com",
  ".beta.lovable.dev",
];

function isPreviewHost(host: string): boolean {
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host === "lovableproject-dev.com" || host === "beta.lovable.dev") return true;
  return PREVIEW_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function shouldSkipPersistence(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true; // iframe (Lovable preview)
  } catch {
    return true;
  }
  if (!import.meta.env.PROD) return true;
  return isPreviewHost(window.location.hostname);
}

export function OfflineQueryProvider({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  const skip = shouldSkipPersistence();

  const persistOptions = useMemo(() => {
    if (skip) return null;
    const persister = createAsyncStoragePersister({
      storage: {
        getItem: (key) => idbGet<string>(key).then((v) => v ?? null),
        setItem: (key, value) => idbSet(key, value),
        removeItem: (key) => idbDel(key),
      },
      key: QUERY_CACHE_KEY,
      throttleTime: 1000,
    });
    return {
      persister,
      maxAge: MAX_AGE,
      buster: BUSTER,
      dehydrateOptions: {
        shouldDehydrateQuery: (query: { state: { status: string } }) =>
          query.state.status === "success",
      },
    };
  }, [skip]);

  // Purge persisted cache on sign-out so the next user can't read stale data.
  useEffect(() => {
    if (skip) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        idbDel(QUERY_CACHE_KEY).catch(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [skip, queryClient]);

  if (!persistOptions) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}

/** Listens to navigator online/offline and renders a subtle banner when offline. */
export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] bg-amber-500/90 text-amber-950 text-xs font-medium text-center py-1 px-3 shadow-sm">
      Offline — showing last saved data
    </div>
  );
}
