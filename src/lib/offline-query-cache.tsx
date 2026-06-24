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

/**
 * Subtle bottom strip: shows "Offline" while disconnected, briefly "Back online" on reconnect.
 *
 * Uses TanStack Query's `onlineManager` as the source of truth (same signal that
 * pauses/resumes queries), plus an active same-origin HEAD probe to overrule
 * false-negative `navigator.onLine` values seen on Android WebView / installed
 * PWAs / VPN flaps. Without the probe the banner can stick on "Offline" even
 * with a working connection until the OS happens to fire an `online` event.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    // Trust the OS only when it says we're online; verify "offline" with a probe.
    return navigator.onLine !== false ? true : onlineManager.isOnline();
  });
  const [justReconnected, setJustReconnected] = useState(false);
  const probing = useRef(false);

  // Active probe — fetches a tiny same-origin resource. Resolves false negatives.
  const probe = async () => {
    if (probing.current) return;
    probing.current = true;
    try {
      const res = await fetch(`/favicon.ico?_probe=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
      });
      if (res.ok || res.status < 500) {
        onlineManager.setOnline(true);
      }
    } catch {
      // Probe failed → trust the offline signal.
    } finally {
      probing.current = false;
    }
  };

  useEffect(() => {
    // Subscribe to TanStack Query's onlineManager — it already debounces
    // `online`/`offline` events and is the truth used to pause queries.
    const unsub = onlineManager.subscribe((isOnline) => {
      setOnline((prev) => {
        if (isOnline && !prev) {
          setJustReconnected(true);
          setTimeout(() => setJustReconnected(false), 2500);
        }
        return isOnline;
      });
    });

    // If navigator says offline at mount, double-check with a probe before
    // showing the amber pill (Android WebView often boots with onLine=false).
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      probe();
    }

    // Re-verify when the tab becomes visible again — phones often suspend
    // network events while the app is backgrounded.
    const onVisible = () => {
      if (document.visibilityState === "visible") probe();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", probe);

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", probe);
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


