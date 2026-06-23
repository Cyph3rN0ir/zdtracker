import { useEffect } from "react";

// PWA service-worker registration with strict safety guards:
// - only in production builds
// - never inside the Lovable preview iframe / preview hostnames
// - skip when ?sw=off is in the URL (kill-switch for users)
// The SW provides offline app-shell caching; see public/sw.js.
export function PWAUpdater() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const url = new URL(window.location.href);
    const host = window.location.hostname;
    const inIframe = window.self !== window.top;
    const isPreview =
      host.startsWith("id-preview--") ||
      host.startsWith("preview--") ||
      host === "lovableproject.com" ||
      host.endsWith(".lovableproject.com") ||
      host === "lovableproject-dev.com" ||
      host.endsWith(".lovableproject-dev.com") ||
      host === "beta.lovable.dev" ||
      host.endsWith(".beta.lovable.dev");
    const isKillSwitch = url.searchParams.get("sw") === "off";
    const isDev = !import.meta.env.PROD;

    if (isDev || inIframe || isPreview || isKillSwitch) {
      // Refuse — and clean up any old registration.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.allSettled(regs.map((r) => r.unregister())))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {});
  }, []);
  return null;
}
