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

  return (
    <div className="aurora-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 sm:py-14">
      <div className="w-full max-w-sm animate-fade-in space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg">
              Z
            </div>
            <span className="truncate text-[11px] font-display font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("brand")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/70 bg-card/60 p-0.5 backdrop-blur">
            <button type="button" onClick={() => setLang("en")}
              className={`tap rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>EN</button>
            <button type="button" onClick={() => setLang("bn")}
              className={`tap rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${lang === "bn" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={{ fontFamily: '"Hind Siliguri", sans-serif' }}>বাংলা</button>
          </div>
        </div>

        <Card className="glass-panel rounded-3xl border-0 shadow-none">
          <CardHeader className="space-y-1.5 pb-2">
            <CardTitle className="font-display text-2xl tracking-tight sm:text-3xl">{t("auth.signIn")}</CardTitle>
            <CardDescription className="text-sm">{t("auth.subtitle")}</CardDescription>
          </CardHeader>
          <form onSubmit={submit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="u" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("auth.username")}</Label>
                <Input id="u" autoFocus required autoComplete="username" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 rounded-xl bg-background/60 text-base" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("auth.password")}</Label>
                <Input id="p" type="password" required autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl bg-background/60 text-base" />
              </div>
              {err && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" disabled={busy} className="tap h-11 w-full rounded-xl text-sm font-semibold shadow-lg">
                {busy ? t("auth.signingIn") : t("auth.signIn")}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground">
          {t("brand")} · secure workspace access
        </p>
      </div>
    </div>
  );
}
