import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { loginFn, meFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const me = await meFn();
    if (me) throw redirect({ to: "/" });
  },
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — ZeroTrack" }] }),
});

function AuthPage() {
  const login = useServerFn(loginFn);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login({ data: { username, password } });
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e?.message ?? "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm border border-border bg-card p-8">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">ZeroTrack</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Sign in</h1>
        </div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-input px-3 py-2 mb-4 text-sm outline-none focus:border-foreground"
          required
        />
        <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-input px-3 py-2 mb-4 text-sm outline-none focus:border-foreground"
          required
        />
        {err && <div className="text-xs text-destructive mb-3">{err}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-6 text-xs text-muted-foreground text-center">
          Accounts are created by the administrator.
        </p>
      </form>
    </div>
  );
}
