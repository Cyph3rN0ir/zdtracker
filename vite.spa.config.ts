// Standalone SPA build config for Capacitor (mobile APK).
// This is intentionally separate from the main vite.config.ts which targets
// Cloudflare Workers via TanStack Start / Nitro SSR.
//
// This config produces a pure client-side SPA in dist-spa/ that Capacitor
// packages into the Android WebView. No server runtime is required — the
// Capacitor config points the WebView at https://zerosync.pages.dev so all
// server functions, session auth, and API routes hit the live deployment.
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * TanStack Start uses two kinds of magic identifiers that Vite/rolldown can't
 * resolve in a plain SPA build:
 *
 * 1. Package `imports` map (`#tanstack-start-entry` etc.) — self-referential
 *    specifiers inside @tanstack packages. We resolve these to the fake/stub
 *    files TanStack ships for SPA use.
 *
 * 2. Virtual modules (`tanstack-start-manifest:v` etc.) — normally injected
 *    by the TanStack Vite plugin during the full SSR build. In a SPA build
 *    these are dead code (SSR-only paths), so we stub them as empty modules.
 */
function tanstackStartSpaStubsPlugin(): Plugin {
  const startClientCorePath = path.resolve(
    "node_modules/@tanstack/start-client-core/dist/esm"
  );

  // Package #imports map stubs → resolved to real fake-entry files
  const fileStubMap: Record<string, string> = {
    "#tanstack-start-entry": path.join(
      startClientCorePath,
      "fake-entries/start.js"
    ),
    "#tanstack-router-entry": path.join(
      startClientCorePath,
      "fake-entries/router.js"
    ),
    "#tanstack-start-plugin-adapters": path.join(
      startClientCorePath,
      "fake-entries/plugin-adapters.js"
    ),
    "#tanstack-start-server-fn-resolver": path.resolve(
      "node_modules/@tanstack/start-server-core/dist/esm/fake-start-server-fn-resolver.js"
    ),
  };

  // Virtual module prefixes → empty module code (SSR-only, dead in SPA)
  const virtualModulePrefixes = [
    "tanstack-start-manifest:",
    "tanstack-start-injected-head-scripts:",
    "tanstack-start-server-fn-manifest:",
    "virtual:tanstack",
  ];

  const VIRTUAL_PREFIX = "\0virtual-tanstack-spa:";

  return {
    name: "tanstack-start-spa-stubs",
    resolveId(id) {
      // Resolve package imports map (#) specifiers
      if (fileStubMap[id]) {
        return fileStubMap[id];
      }
      // Stub out SSR-only virtual modules
      if (virtualModulePrefixes.some((p) => id.startsWith(p))) {
        return VIRTUAL_PREFIX + id;
      }
      return null;
    },
    load(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) {
        // Return an empty module — these are SSR-only and never called client-side
        return "export default {}; export const tsrStartManifest = () => ({ routes: {}, inlineCss: '', clientEntry: '' }); export const injectedHeadScripts = undefined;";
      }
      return null;
    },
  };
}

export default defineConfig({
  // Public assets are copied explicitly by build:spa. This also lets us emit
  // the dedicated web offline shell beneath public/offline-app safely.
  publicDir: false,
  plugins: [
    tanstackStartSpaStubsPlugin(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  // Relative paths so assets resolve correctly from Capacitor's file:// context
  // when used in offline/fallback mode.
  base: "./",
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
    // Inline small assets to reduce request count in WebView.
    assetsInlineLimit: 8192,
    rollupOptions: {
      input: {
        main: "index.spa.html",
      },
    },
  },
  // Resolve the same aliases used by the main app.
  resolve: {
    alias: {
      "@": path.resolve("src"),
    },
  },
  // Prevent Vite from trying to SSR-transform server-only modules at dep
  // optimisation time — they are dead code in the SPA build.
  optimizeDeps: {
    exclude: ["@tanstack/react-start/server"],
  },
});
