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
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "./router";

// Import global styles
import "./styles.css";

// Build the router (same one used by the SSR app).
const router = getRouter();

// Route the downloaded client through its lean cold-start layout. The normal
// TanStack Start document does not set this marker and keeps the full online
// layout with warmup, push, polling, and pull-to-refresh.
document.documentElement.dataset.zerosyncShell = "offline";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element found");

ReactDOM.createRoot(root).render(
  <RouterProvider router={router} />,
);
