import { useSession } from "@tanstack/react-start/server";

export type SessionData = {
  userId?: string;
  username?: string;
  role?: "admin" | "owner" | "investor" | "member";
  displayName?: string;
};

/**
 * Resolve the cookie-sealing secret.
 *
 * Order:
 *  1. An explicit session secret (any of the supported env names).
 *  2. A secret DERIVED from another server-only secret that this deployment
 *     already needs (service-role key / VAPID private key). This keeps the
 *     cookie unforgeable without shipping a hardcoded/public fallback, and it
 *     means a deployment host that only has the Supabase secrets configured
 *     (e.g. Cloudflare Pages) still boots instead of 500-ing every request.
 *
 * Never pad an empty value with a constant — that would make the sealing key
 * public knowledge and let anyone forge an admin session.
 */
function resolveSessionPassword(): string {
  const explicit = [
    process.env.SESSION_SECRET,
    process.env.ZT_SESSION_SECRET,
    process.env.ZEROSYNC_SESSION_SECRET,
  ].find((v) => typeof v === "string" && v.length >= 32);
  if (explicit) return explicit;

  const derivedFrom = [
    process.env.ZT_SUPABASE_SERVICE_ROLE_KEY,
    process.env.ZEROSYNC_VAPID_PRIVATE_KEY,
    process.env.VAPID_PRIVATE_KEY,
    process.env.WEB_PUSH_PRIVATE_KEY,
  ].find((v) => typeof v === "string" && v.length >= 20);

  if (derivedFrom) {
    // Deterministic, deployment-specific, and never exposed to the client.
    return `zt_session_v1:${derivedFrom}`.slice(0, 96).padEnd(32, "_");
  }

  throw new Error(
    "No session secret available. Set SESSION_SECRET (32+ random characters) in the deployment environment.",
  );
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
