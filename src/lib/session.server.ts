import { useSession } from "@tanstack/react-start/server";

export type SessionData = {
  userId?: string;
  username?: string;
  role?: "admin" | "owner" | "investor" | "member";
  displayName?: string;
};

export function getSessionConfig() {
  const password = process.env.SESSION_SECRET ?? "";
  if (password.length < 32) {
    // Fail closed: never fall back to a source-visible padding string, which
    // would make the session-signing key guessable and allow cookie forgery.
    throw new Error(
      "SESSION_SECRET is missing or too short. Set it to at least 32 random characters.",
    );
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
