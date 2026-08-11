// Single guarded PWA service-worker registration point. Uses the shared
// host guard so SW registration and Query-cache persistence enable/disable
// together — they MUST stay in sync, or the app caches data with no SW to
// serve the shell offline (or vice-versa).

import { shouldDisablePwaFeatures } from "@/lib/pwa-host-guard";

type UpdateCallback = () => void;
const SHELL_CACHE = "zs-shell-v5";
const APP_SHELL_KEY = "/__zerosync_app_shell__";
const offlineRouteModules = import.meta.glob("/src/routes/**/*.tsx");

function collectShellUrls(): string[] {
  const urls = new Set<string>([window.location.href]);
  document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]").forEach((node) => {
    const value = node instanceof HTMLScriptElement ? node.src : node.href;
    if (value) urls.add(value);
  });
  performance
    .getEntriesByType("resource")
    .filter((entry) =>
      ["script", "link", "img", "css"].includes(
        (entry as PerformanceResourceTiming).initiatorType,
      ),
    )
    .forEach((entry) => urls.add(entry.name));
  return Array.from(urls);
}

async function warmAppShell(registration: ServiceWorkerRegistration) {
  // Write the authenticated document directly as well as asking the worker to
  // warm it. This removes a message/activation race on Android WebView.
  let shellReady = false;
  try {
    const response = await fetch(window.location.href, {
      credentials: "include",
      cache: "reload",
    });
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all([
        cache.put(window.location.href, response.clone()),
        cache.put(APP_SHELL_KEY, response.clone()),
      ]);
      shellReady = true;
    }
  } catch {}

  // Load every lazy route once while online. Vite resolves these to the same
  // hashed chunks used by the router, and the worker caches their responses.
  // This gives Android all screens without a deployment-time asset manifest.
  await Promise.allSettled(Object.values(offlineRouteModules).map((load) => load()));

  const worker = registration.active ?? registration.waiting ?? registration.installing;
  worker?.postMessage({ type: "CACHE_APP_SHELL", urls: collectShellUrls() });
  if (shellReady) localStorage.setItem("zs:offline-shell-ready:v1", String(Date.now()));
}

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
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    await warmAppShell(registration);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      warmAppShell(registration).catch(() => {});
      onUpdate?.();
    });
    return null;
  } catch (err) {
    console.warn("[pwa] registration failed", err);
    return null;
  }
}
