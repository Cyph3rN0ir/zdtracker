// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Manifest-only PWA: home-screen installability + PWABuilder APK conversion
// only require public/manifest.webmanifest + icons + head meta tags. No
// service worker is registered. A kill-switch /sw.js cleans up returning
// visitors that still have the previous vite-plugin-pwa SW installed.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
});
