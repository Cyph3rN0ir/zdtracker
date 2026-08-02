import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { loginFn, meFn } from "@/lib/auth.functions";
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
    <div className="flex min-h-dvh flex-col justify-center bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-[22rem] animate-fade-in">
        {/* Brand row */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              Z
            </div>
            <span
              className={`truncate text-muted-foreground ${brandClass}`}
              style={bn ? { fontFamily: '"Hind Siliguri", sans-serif' } : undefined}
            >
              {t("brand")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`tap transition-colors ${lang === "en" ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground"}`}
            >
              EN
            </button>
            <span className="h-3 w-px bg-border" />
            <button
              type="button"
              onClick={() => setLang("bn")}
              className={`tap transition-colors ${bn ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground"}`}
              style={{ fontFamily: '"Hind Siliguri", sans-serif' }}
            >
              বাংলা
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="mt-12">
          <h1 className="font-display text-[26px] leading-tight tracking-tight">{t("auth.signIn")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("auth.subtitle")}</p>

          <div className="mt-8 space-y-5">
            <div>
              <Label htmlFor="u" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("auth.username")}
              </Label>
              <Input
                id="u"
                autoFocus
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-base shadow-none transition-colors focus-visible:border-primary focus-visible:ring-0"
              />
            </div>
            <div>
              <Label htmlFor="p" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("auth.password")}
              </Label>
              <Input
                id="p"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-9 rounded-none border-0 border-b border-border bg-transparent px-0 text-base shadow-none transition-colors focus-visible:border-primary focus-visible:ring-0"
              />
            </div>
          </div>

          {err && (
            <Alert variant="destructive" className="mt-5 rounded-lg py-2.5 text-[13px]">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="tap mt-8 h-10 w-full rounded-full text-[13px] font-semibold tracking-wide"
          >
            {busy ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </form>
      </div>
    </div>
  );
}

