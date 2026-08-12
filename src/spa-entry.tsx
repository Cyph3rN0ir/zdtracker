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

const root = document.getElementById("root");
if (!root) throw new Error("No #root element found");

ReactDOM.createRoot(root).render(
  <RouterProvider router={router} />,
);
