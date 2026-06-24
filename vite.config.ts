// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Offline PWA support: vite-plugin-pwa generates /sw.js for published builds.
// Registration is still guarded in src/lib/pwa-register.ts so dev/preview never
// get sticky service-worker caches.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        filename: "sw.js",
        registerType: "autoUpdate",
        injectRegister: null,
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          navigateFallback: "/",
          // Routes that must NEVER serve the cached app shell offline (OAuth
          // brokers, raw API endpoints, the auth flow itself — the app shell
          // would immediately call protected server fns and 401-spam).
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/auth(\/|$)/],
          additionalManifestEntries: [
            { url: "/", revision: null },
            { url: "/offline.html", revision: null },
          ],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                url.origin === self.location.origin &&
                !url.pathname.startsWith("/~oauth") &&
                !url.pathname.startsWith("/api/") &&
                !url.pathname.startsWith("/auth"),
              handler: "NetworkFirst",
              options: {
                cacheName: "zs-html-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
                plugins: [
                  {
                    // When offline AND no cached HTML for this URL exists,
                    // serve the precached /offline.html page so the user
                    // sees a branded retry screen instead of a browser
                    // "no internet" error.
                    handlerDidError: async () => {
                      const cache = await caches.open("zs-html-pages");
                      return (
                        (await cache.match("/offline.html")) ||
                        (await caches.match("/offline.html")) ||
                        Response.error()
                      );
                    },
                  },
                ],
              },
            },
            {
              urlPattern: ({ url }) =>
                url.origin === self.location.origin &&
                (url.pathname.startsWith("/assets/") ||
                  /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)),
              handler: "CacheFirst",
              options: {
                cacheName: "zs-static-assets",
                expiration: { maxEntries: 240, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
  },
});
