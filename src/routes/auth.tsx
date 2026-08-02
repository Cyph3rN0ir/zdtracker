import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { loginFn, meFn } from "@/lib/auth.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";

const ME_CACHE_KEY = "zs:me:v1";

function hasCachedMe() {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(ME_CACHE_KEY);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine && hasCachedMe()) {
      throw redirect({ to: "/" });
    }
    const me = await meFn();
    if (me) throw redirect({ to: "/" });
  },
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — ZeroSync" }] }),
});

function AuthPage() {
  const login = useServerFn(loginFn);
  const navigate = useNavigate();
  const { lang, setLang, t } = useI18n();
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
      setErr(e?.message ?? t("auth.failed"));
      setBusy(false);
    }
  }

  const bn = lang === "bn";
  const brandClass = bn
    ? "text-sm font-semibold"
    : "text-[11px] font-display font-bold uppercase tracking-[0.2em]";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-8">
      <div className="w-full max-w-md animate-fade-in overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {/* Brand band */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-muted/40 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              Z
            </div>
            <span
              className={`truncate text-muted-foreground ${brandClass}`}
              style={bn ? { fontFamily: '"Hind Siliguri", sans-serif' } : undefined}
            >
              {t("brand")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`tap rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("bn")}
              className={`tap rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${bn ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={{ fontFamily: '"Hind Siliguri", sans-serif' }}
            >
              বাংলা
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-5 sm:p-7">
          <h1 className="font-display text-2xl tracking-tight sm:text-3xl">{t("auth.signIn")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background/60">
            <div className="p-3.5">
              <Label htmlFor="u" className="text-xs font-medium text-muted-foreground">
                {t("auth.username")}
              </Label>
              <Input
                id="u"
                autoFocus
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 h-10 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="p-3.5">
              <Label htmlFor="p" className="text-xs font-medium text-muted-foreground">
                {t("auth.password")}
              </Label>
              <Input
                id="p"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-10 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          {err && (
            <Alert variant="destructive" className="mt-4 rounded-xl">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={busy} className="tap mt-5 h-11 w-full rounded-xl text-sm font-semibold">
            {busy ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </form>

      </div>
    </div>
  );
}
