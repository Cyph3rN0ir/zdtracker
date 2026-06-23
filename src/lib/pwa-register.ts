// Guarded PWA service-worker registration. Never registers in dev,
// inside an iframe, in Lovable preview hosts, or when ?sw=off is set.
// Returns an updater function the UI can call when the user accepts an update.

type UpdateCallback = () => void;

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

async function unregisterAllAppWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
          return url.endsWith("/sw.js") || url.endsWith("/service-worker.js");
        })
        .map((r) => r.unregister()),
    );
  } catch {}
}

export async function registerPWA(onUpdate?: UpdateCallback): Promise<(() => Promise<void>) | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  const url = new URL(window.location.href);
  const inIframe = window.self !== window.top;
  const dev = !import.meta.env.PROD;
  const preview = isPreviewHost(window.location.hostname);
  const killSwitch = url.searchParams.get("sw") === "off";

  if (dev || inIframe || preview || killSwitch) {
    await unregisterAllAppWorkers();
    return null;
  }

  try {
    // Plain registration — the generated SW already uses skipWaiting +
    // clientsClaim, so there is no "waiting" state to coordinate from the
    // page. Avoid workbox-window's update plumbing to keep installs simple
    // and prevent extra reloads on first activation.
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    onUpdate?.();
    return null;
  } catch (err) {
    console.warn("[pwa] registration failed", err);
    return null;
  }
}

