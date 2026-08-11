const SHELL_CACHE = "zs-shell-v5";
const ASSET_CACHE = "zs-assets-v5";
const APP_SHELL_KEY = "/__zerosync_app_shell__";

function cacheNavigationDocument(): Promise<void> {
  return new Promise((resolve, reject) => {
    // TanStack Start returns different boot metadata for a document navigation
    // than for fetch("/"). Let the controlled service worker observe a real,
    // hidden navigation so its APP_SHELL_KEY contains a cold-bootable response.
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.setAttribute("aria-hidden", "true");
    const timeout = window.setTimeout(() => {
      frame.remove();
      reject(new Error("Timed out while saving the offline app document"));
    }, 20_000);
    frame.onload = () => {
      window.clearTimeout(timeout);
      try {
        const html = frame.contentDocument?.documentElement.outerHTML ?? "";
        frame.remove();
        if (!html.includes("ZeroSync")) {
          reject(new Error("The offline app navigation was incomplete"));
          return;
        }
        resolve();
      } catch (error) {
        frame.remove();
        reject(error);
      }
    };
    frame.onerror = () => {
      window.clearTimeout(timeout);
      frame.remove();
      reject(new Error("Could not save the offline app navigation"));
    };
    const url = new URL("/", window.location.origin);
    url.searchParams.set("_offline_shell", String(Date.now()));
    frame.src = url.href;
    document.body.appendChild(frame);
  });
}

/** Save a validated authenticated document for Android/PWA cold launches. */
export async function saveAuthenticatedAppShell(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Offline app storage is not available in this environment");
  }

  const response = await fetch(new URL("/", window.location.origin), {
    credentials: "include",
    cache: "reload",
  });
  if (!response.ok) throw new Error(`Could not save the offline app (${response.status})`);

  const html = await response.clone().text();
  if (!html.includes("<html") || !html.includes("ZeroSync")) {
    throw new Error("The downloaded offline app document was incomplete");
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  const criticalUrls = Array.from(
    document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
      "script[src], link[rel='stylesheet'][href], link[rel='modulepreload'][href]",
    ),
    (node) =>
      new URL(
        node.getAttribute(node instanceof HTMLScriptElement ? "src" : "href") ?? "",
        window.location.origin,
      ),
  ).filter((url) => url.origin === window.location.origin);
  const discoveredUrls = performance
    .getEntriesByType("resource")
    .map((entry) => new URL(entry.name, window.location.origin))
    .filter(
      (url) =>
        url.origin === window.location.origin &&
        (url.pathname.startsWith("/assets/") ||
          /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)),
    );
  const assetUrls = new Map([...criticalUrls, ...discoveredUrls].map((url) => [url.href, url]));
  const assetCache = await caches.open(ASSET_CACHE);
  const failedCritical = new Set(criticalUrls.map((url) => url.href));
  await Promise.all(
    Array.from(assetUrls.values(), async (url) => {
      try {
        const assetResponse = await fetch(url, {
          credentials: "include",
          cache: "reload",
        });
        if (!assetResponse.ok) return;
        await assetCache.put(url.href, assetResponse);
        failedCritical.delete(url.href);
      } catch {
        // Critical failures are reported below; optional discovered resources
        // do not make the whole download fail.
      }
    }),
  );
  if (failedCritical.size > 0) {
    throw new Error(`Could not save ${failedCritical.size} required offline app files`);
  }

  const cache = await caches.open(SHELL_CACHE);
  await Promise.all([
    cache.put(
      new Request(new URL("/", window.location.origin), { credentials: "include" }),
      response.clone(),
    ),
    cache.put(APP_SHELL_KEY, response.clone()),
  ]);
  await cacheNavigationDocument();
  window.localStorage.setItem("zs:offline-shell-ready:v1", String(Date.now()));
}
