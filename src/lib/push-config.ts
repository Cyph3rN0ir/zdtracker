// Public VAPID key — safe to ship to clients. Keep in sync with VAPID_PUBLIC_KEY secret.
export const VAPID_PUBLIC_KEY =
  "BKLhWdTg2ZaIuTrJ-wrtkFW0oOYon4_acpzDzNThIMSiOa9TLQIlqIwQXk2w6k-o4qf57ewQ_JO9nzVs1QhbW8A";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
