import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

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
    const { data: sub } = getSupabaseBrowser().auth.onAuthStateChange((event: string) => {
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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => {
        // After cache rehydrates from IndexedDB, refresh stale data in the
        // background when online — keeps screens snappy + eventually fresh.
        if (typeof navigator === "undefined" || navigator.onLine) {
          queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
        }
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

/** Subtle bottom strip: shows "Offline" while disconnected, briefly "Back online" on reconnect. */
export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 2500);
      return () => clearTimeout(t);
    };
    const off = () => {
      setOnline(false);
      setJustReconnected(false);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online && !justReconnected) return null;
  const offline = !online;
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "fixed inset-x-0 bottom-3 z-[60] mx-auto w-fit max-w-[92vw] rounded-full px-3.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur " +
        (offline
          ? "bg-amber-500/95 text-amber-950"
          : "bg-emerald-500/95 text-emerald-950")
      }
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {offline ? "Offline — showing last saved data" : "Back online — syncing"}
    </div>
  );
}

