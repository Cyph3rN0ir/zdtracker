/**
 * Pure client-side entry point for the Capacitor (mobile) SPA build.
 *
 * Unlike the normal TanStack Start entry (which uses SSR hydration via
 * createStart / startInstance), this entry mounts React directly using
 * ReactDOM.createRoot — no server runtime needed.
 *
 * The Capacitor config points the WebView at https://zerosync.pages.dev so
 * all createServerFn calls, cookie-based auth, and API routes work against
 * the live Cloudflare deployment transparently.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

import { getRouter } from "./router";

// Import global styles
import "./styles.css";

// Build the router (same one used by the SSR app).
const router = getRouter();

// Set up React Query persistence so cached data survives app restarts,
// matching the offline behaviour of the PWA web app.
const queryClient = router.options.context.queryClient;
const persister = createSyncStoragePersister({ storage: window.localStorage });

const root = document.getElementById("root");
if (!root) throw new Error("No #root element found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 30 }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
