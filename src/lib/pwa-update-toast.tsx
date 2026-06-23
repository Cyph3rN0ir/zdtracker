import { useEffect } from "react";
import { registerPWA } from "@/lib/pwa-register";

// PWA service-worker registration with strict safety guards:
// - only in production builds
// - never inside the Lovable preview iframe / preview hostnames
// - skip when ?sw=off is in the URL (kill-switch for users)
// The SW provides offline app-shell caching; see public/sw.js.
export function PWAUpdater() {
  useEffect(() => {
    registerPWA().catch(() => {});
  }, []);
  return null;
}
