const SHELL_CACHE = "zs-shell-v5";
const APP_SHELL_KEY = "/__zerosync_app_shell__";

/** Save a validated authenticated document for Android/PWA cold launches. */
export async function saveAuthenticatedAppShell(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Offline app storage is not available in this environment");
  }

  const response = await fetch(new URL("/", window.location.origin), {
    credentials: "include",
    cache: "reload",
  });
  if (!response.ok) throw new Error(`Could not save the offline app (${response.status})`);

  const html = await response.clone().text();
  if (!html.includes("<html") || !html.includes("ZeroSync")) {
    throw new Error("The downloaded offline app document was incomplete");
  }

  const cache = await caches.open(SHELL_CACHE);
  await Promise.all([
    cache.put(
      new Request(new URL("/", window.location.origin), { credentials: "include" }),
      response.clone(),
    ),
    cache.put(APP_SHELL_KEY, response.clone()),
  ]);
  window.localStorage.setItem("zs:offline-shell-ready:v1", String(Date.now()));
}
