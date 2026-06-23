// ZeroSync PWA service worker.
// - NetworkFirst for HTML navigations (always tries the network, falls back
//   to last cached HTML, then to /offline.html if both fail).
// - CacheFirst for /assets/* (Vite hashed files — safe to cache forever).
// - Bypass everything else (Supabase API calls go straight to the network).
//
// On version bump, change CACHE_VERSION to invalidate old caches.

const CACHE_VERSION = "v2";
const PAGE_CACHE = `zs-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `zs-assets-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((c) => c.addAll([OFFLINE_URL])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGE_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // skip cross-origin (Supabase etc.)

  // HTML navigations: network-first.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(PAGE_CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(PAGE_CACHE);
          const cached = await cache.match(req);
          if (cached) return cached;
          return (await cache.match(OFFLINE_URL)) ?? new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Hashed assets: cache-first.
  if (url.pathname.startsWith("/assets/") || /\.(?:js|css|woff2?|png|jpg|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          return cached ?? new Response("", { status: 504 });
        }
      })(),
    );
    return;
  }
});
