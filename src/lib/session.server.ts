import { useSession } from "@tanstack/react-start/server";

export type SessionData = {
  userId?: string;
  username?: string;
  role?: "admin" | "owner" | "investor" | "member";
  displayName?: string;
};

export function getSessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set (>=32 chars)");
  }
  return {
    password,
    name: "zt_session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { sameSite: "lax" as const, httpOnly: true, secure: true, path: "/" },
  };
}

export async function getSession() {
  return useSession<SessionData>(getSessionConfig());
}
