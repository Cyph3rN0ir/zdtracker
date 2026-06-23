// Kill-switch service worker. Replaces any previously deployed app SW
// (vite-plugin-pwa / workbox) so returning installs evict their old
// registration on next visit. Cache Storage is origin-scoped — only delete
// the app SW's own Workbox caches so unrelated workers (e.g. Firebase
// Messaging) keep their caches.

function isWorkboxCacheForThisRegistration(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)html-pages|(^|-)static-assets|(^|-)images|(^|-)fonts|(^|-)google-fonts|(^|-)supabase-rest/.test(name);
  return hasWorkboxBucket;
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const toDelete = cacheNames.filter(isWorkboxCacheForThisRegistration);
        await Promise.allSettled(toDelete.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(windowClients.map((c) => c.navigate(c.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
