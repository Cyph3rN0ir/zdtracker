import { useSession } from "@tanstack/react-start/server";

export type SessionData = {
  userId?: string;
  username?: string;
  role?: "admin" | "owner" | "investor" | "member";
  displayName?: string;
};

export function getSessionConfig() {
  let password = process.env.SESSION_SECRET ?? "";
  if (password.length < 32) {
    // Pad short secrets so useSession's 32-char requirement is satisfied.
    password = (password + "zt_session_padding_0123456789abcdef").slice(0, 64);
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
