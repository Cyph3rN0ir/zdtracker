// Single source of truth for the app-wide offline/sync indicator.
//
// Phase 1 surfaces the *plumbing* states only (restoring/online/offline). The
// `syncing` / `sync-failed` states will be driven by the proactive warmup
// added in Phase 2.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onlineManager } from "@tanstack/react-query";

export type OfflineStatus =
  | "restoring" // hydrating persisted Query cache from IndexedDB
  | "online" // connected, nothing in-flight
  | "syncing" // background warmup / bulk prefetch in progress
  | "offline" // disconnected
  | "sync-failed"; // background warmup tried and failed (still usable)

type Ctx = {
  status: OfflineStatus;
  isOnline: boolean;
  isRestoring: boolean;
  setRestoring: (v: boolean) => void;
  setSyncing: (v: boolean) => void;
  setSyncFailed: (v: boolean) => void;
};

const OfflineStatusContext = createContext<Ctx | null>(null);

export function useOfflineStatus(): Ctx {
  const ctx = useContext(OfflineStatusContext);
  if (!ctx) throw new Error("useOfflineStatus must be used inside OfflineStatusProvider");
  return ctx;
}

export function OfflineStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  const [isRestoring, setRestoring] = useState(false);
  const [isSyncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const probing = useRef(false);

  // Active same-origin probe — resolves false-negative `navigator.onLine`.
  const probe = async () => {
    if (probing.current) return;
    probing.current = true;
    try {
      const res = await fetch(`/favicon.ico?_probe=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
      });
      if (res.ok || res.status < 500) onlineManager.setOnline(true);
    } catch {
      // Probe failed → trust the offline signal.
    } finally {
      probing.current = false;
    }
  };

  useEffect(() => {
    const unsub = onlineManager.subscribe((next) => setOnline(next));
    if (typeof navigator !== "undefined" && navigator.onLine === false) probe();
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

  const status: OfflineStatus = !isOnline
    ? "offline"
    : isRestoring
      ? "restoring"
      : isSyncing
        ? "syncing"
        : syncFailed
          ? "sync-failed"
          : "online";

  const value = useMemo<Ctx>(
    () => ({
      status,
      isOnline,
      isRestoring,
      setRestoring,
      setSyncing,
      setSyncFailed,
    }),
    [status, isOnline, isRestoring],
  );

  return (
    <OfflineStatusContext.Provider value={value}>{children}</OfflineStatusContext.Provider>
  );
}
