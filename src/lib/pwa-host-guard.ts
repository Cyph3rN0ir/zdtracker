// Shared host/runtime guard used by both the service-worker registration
// (src/lib/pwa-register.ts) and the persistent Query cache
// (src/lib/offline-query-cache.tsx). Centralising the rule prevents the
// two layers from drifting (e.g. SW registered but persistence disabled).
//
// Returns true when offline/PWA behavior MUST be skipped:
// - SSR (no window)
// - dev builds
// - inside an iframe (Lovable preview)
// - Lovable preview hostnames
// - the `?sw=off` kill switch

const PREVIEW_HOST_SUFFIXES = [
  ".lovableproject.com",
  ".lovableproject-dev.com",
  ".beta.lovable.dev",
];

const PREVIEW_HOSTS_EXACT = new Set([
  "lovableproject.com",
  "lovableproject-dev.com",
  "beta.lovable.dev",
]);

export function isPreviewHost(host: string): boolean {
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (PREVIEW_HOSTS_EXACT.has(host)) return true;
  return PREVIEW_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function isKillSwitchActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(window.location.href).searchParams.get("sw") === "off";
  } catch {
    return false;
  }
}

export function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * True when offline/PWA features (SW registration, Query persistence) must
 * be skipped — SSR, dev, preview iframes, preview hostnames, or `?sw=off`.
 */
export function shouldDisablePwaFeatures(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (isInIframe()) return true;
  if (isPreviewHost(window.location.hostname)) return true;
  if (isKillSwitchActive()) return true;
  return false;
}
