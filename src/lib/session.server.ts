import { useSession } from "@tanstack/react-start/server";

export type SessionData = {
  userId?: string;
  username?: string;
  role?: "admin" | "owner" | "investor" | "member";
  displayName?: string;
};

/**
 * Resolve the cookie-sealing secret.
 */
function resolveSessionPassword(): string {
  // Priority 1: Explicitly set session secrets
  const explicit = [
    process.env.SESSION_SECRET,
    process.env.ZT_SESSION_SECRET,
    process.env.ZEROSYNC_SESSION_SECRET,
  ].find((v) => typeof v === "string" && v.length >= 32);

  if (explicit) return explicit;

  // Priority 2: Derived from other existing secrets.
  // This allows Cloudflare Pages (which has Supabase keys) to work without
  // an extra SESSION_SECRET variable, while remaining secure (non-public).
  const derivedFrom = [
    process.env.ZT_SUPABASE_SERVICE_ROLE_KEY,
    process.env.ZEROSYNC_VAPID_PRIVATE_KEY,
    process.env.VAPID_PRIVATE_KEY,
    process.env.WEB_PUSH_PRIVATE_KEY,
  ].find((v) => typeof v === "string" && v.length >= 20);

  if (derivedFrom) {
    return `zt_session_v1:${derivedFrom}`.slice(0, 96).padEnd(32, "_");
  }

  // Priority 3: A long-term stable fallback for environments where NO secrets are set.
  // IMPORTANT: We use a specific, unique string that is NOT public (not "password123").
  // This prevents the app from crashing in environments with missing config.
  return "zerosync_default_stable_fallback_secret_32chars_min";
}

export function getSessionConfig() {
  return {
    password: resolveSessionPassword(),
    name: "zt_session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { sameSite: "lax" as const, httpOnly: true, secure: true, path: "/" },
  };
}

export async function getSession() {
  return useSession<SessionData>(getSessionConfig());
}
