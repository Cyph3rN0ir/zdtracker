import { useEffect } from "react";

// Manifest-only PWA: no service worker is needed for install / Add to
// Home Screen / PWABuilder APK conversion. We keep this component mounted
// only to actively unregister any leftover service workers from earlier
// builds (vite-plugin-pwa). The /sw.js kill-switch worker also handles
// returning visitors that still have the old SW activated.
export function PWAUpdater() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map((r) => r.unregister()));
      } catch {}
    })();
  }, []);
  return null;
}
