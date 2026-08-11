// ZeroSync Service Worker — push notifications + minimal navigation fallback.
// Registered only in production from src/lib/pwa-register.ts.

const OFFLINE_URL = "/offline.html";
const SHELL_CACHE = "zs-shell-v5";
const ASSET_CACHE = "zs-assets-v5";
const APP_SHELL_KEY = "/__zerosync_app_shell__";
const OWNED_CACHES = [SHELL_CACHE, ASSET_CACHE];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(OFFLINE_URL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("zs-shell-") || key.startsWith("zs-assets-"))
          .filter((key) => !OWNED_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// Keep a complete authenticated app shell available after the first online sync.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Connectivity probes and RPC calls must never receive cached responses.
  if (url.searchParams.has("_probe") || url.pathname.startsWith("/_serverFn/")) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  if (["script", "style", "font", "image", "manifest"].includes(req.destination)) {
    event.respondWith(cacheFirstAsset(req));
  }
});

async function networkFirstNavigation(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(req);
    if (!response.ok) throw new Error(`Navigation failed: ${response.status}`);
    await Promise.all([
      cache.put(req, response.clone()),
      cache.put(APP_SHELL_KEY, response.clone()),
    ]);
    return response;
  } catch {
    return (
      (await cache.match(req, { ignoreSearch: true })) ||
      (await cache.match(APP_SHELL_KEY)) ||
      (await cache.match(OFFLINE_URL)) ||
      new Response("Offline", { status: 503 })
    );
  }
}

async function cacheFirstAsset(req) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(req);
  if (response.ok) await cache.put(req, response.clone());
  return response;
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_APP_SHELL") {
    const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
    event.waitUntil(cacheShellUrls(urls));
  }
  if (event.data?.type === "CLEAR_APP_CACHE") {
    event.waitUntil(Promise.all(OWNED_CACHES.map((key) => caches.delete(key))));
  }
});

async function cacheShellUrls(urls) {
  const sameOrigin = urls.filter((value) => {
    try {
      const url = new URL(value, self.location.origin);
      return (
        url.origin === self.location.origin &&
        !url.pathname.startsWith("/_serverFn/") &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/~oauth")
      );
    } catch {
      return false;
    }
  });
  const cache = await caches.open(ASSET_CACHE);
  await Promise.allSettled(
    sameOrigin.map(async (value) => {
      const request = new Request(value, { credentials: "include", cache: "reload" });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response);
    }),
  );

  try {
    const documentUrl = sameOrigin[0];
    if (documentUrl) {
      const response = await fetch(documentUrl, { credentials: "include", cache: "reload" });
      if (response.ok) {
        const shell = await caches.open(SHELL_CACHE);
        await shell.put(APP_SHELL_KEY, response);
      }
    }
  } catch {}
}

// ---------------- Push ----------------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try {
      payload = { title: "ZeroSync", body: event.data ? event.data.text() : "" };
    } catch {}
  }

  event.waitUntil(
    (async () => {
      // App badge — best-effort; ignored where unsupported.
      try {
        if (typeof payload.badgeCount === "number" && "setAppBadge" in self.navigator) {
          if (payload.badgeCount > 0) await self.navigator.setAppBadge(payload.badgeCount);
          else await self.navigator.clearAppBadge?.();
        }
      } catch {}

      // Suppress when the target chat thread is already open AND visible.
      const targetUrl = payload.url || "/";
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const focusedOnTarget = all.some((c) => {
        try {
          const u = new URL(c.url);
          return (
            u.origin === self.location.origin &&
            u.pathname === new URL(targetUrl, self.location.origin).pathname &&
            c.visibilityState === "visible" &&
            c.focused
          );
        } catch {
          return false;
        }
      });

      // Tell open clients to refresh unread/badge state regardless.
      for (const c of all) {
        try { c.postMessage({ type: "push", payload }); } catch {}
      }

      if (focusedOnTarget) return;

      await self.registration.showNotification(payload.title || "ZeroSync", {
        body: payload.body || "",
        icon: payload.icon || "/icon-192.png",
        badge: payload.badge || "/icon-192.png",
        tag: payload.tag || undefined,
        renotify: !!payload.tag,
        data: { url: targetUrl, ...(payload.data || {}) },
        requireInteraction: false,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ("navigate" in client) await client.navigate(targetUrl);
            return;
          }
        } catch {}
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
