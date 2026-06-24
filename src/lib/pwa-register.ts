// Single guarded PWA service-worker registration point. Uses the shared
// host guard so SW registration and Query-cache persistence enable/disable
// together — they MUST stay in sync, or the app caches data with no SW to
// serve the shell offline (or vice-versa).

import { shouldDisablePwaFeatures } from "@/lib/pwa-host-guard";

type UpdateCallback = () => void;

async function unregisterAllAppWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => {
          const url =
            r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
          return url.endsWith("/sw.js") || url.endsWith("/service-worker.js");
        })
        .map((r) => r.unregister()),
    );
  } catch {}
}

export async function registerPWA(onUpdate?: UpdateCallback): Promise<(() => Promise<void>) | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  if (shouldDisablePwaFeatures()) {
    await unregisterAllAppWorkers();
    return null;
  }

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    navigator.serviceWorker.addEventListener("controllerchange", () => onUpdate?.());
    return null;
  } catch (err) {
    console.warn("[pwa] registration failed", err);
    return null;
  }
}
