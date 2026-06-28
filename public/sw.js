// ZeroSync Service Worker — push notifications + minimal navigation fallback.
// Registered only in production from src/lib/pwa-register.ts.

const OFFLINE_URL = "/offline.html";
const SHELL_CACHE = "zs-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll([OFFLINE_URL]).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Network-first navigations with offline fallback. Never cache HTML aggressively.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return;
  event.respondWith(
    fetch(req).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      return (await cache.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
    }),
  );
});

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
  const title = payload.title || "ZeroSync";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    data: { url: payload.url || "/", ...(payload.data || {}) },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
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
