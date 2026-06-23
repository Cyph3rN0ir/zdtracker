import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudOff, RefreshCw } from "lucide-react";
import { flushQueue, getQueueSize, subscribeQueue } from "@/lib/offline-queue";

// Top-of-screen banner shown when offline or when there are queued mutations
// waiting to sync. Auto-flushes on `online` event and on mount.
export function OfflineIndicator() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    setQueueSize(getQueueSize());
    const unsub = subscribeQueue(() => setQueueSize(getQueueSize()));
    const onOnline = async () => {
      setOnline(true);
      if (getQueueSize() === 0) return;
      const res = await flushQueue();
      if (res.ok > 0) {
        toast.success(`Synced ${res.ok} offline change${res.ok === 1 ? "" : "s"}`);
        qc.invalidateQueries();
      }
      if (res.failed) toast.error("Some offline changes failed to sync");
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Initial flush attempt on mount (cover the case where we loaded online
    // but the queue still has items from a previous session).
    if (online && getQueueSize() > 0) onOnline();
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (online && queueSize === 0) return null;

  return (
    <div
      className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-md ${
        online
          ? "bg-card border-border text-muted-foreground"
          : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
      }`}
      role="status"
    >
      {online ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Syncing {queueSize} change{queueSize === 1 ? "" : "s"}…
        </>
      ) : (
        <>
          <CloudOff className="h-3.5 w-3.5" />
          Offline{queueSize > 0 ? ` · ${queueSize} pending` : ""}
        </>
      )}
    </div>
  );
}
