import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { loginFn, meFn } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { isOfflineLikeError, readCachedMe, withConnectionTimeout } from "@/lib/cached-session";
import { hasDownloadedOfflineData } from "@/lib/offline-database";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const cached = readCachedMe();
    if (cached && hasDownloadedOfflineData(cached.userId)) throw redirect({ to: "/" });
    if (typeof navigator !== "undefined" && !navigator.onLine && cached) {
      throw redirect({ to: "/" });
    }
    try {
      const me = await withConnectionTimeout(meFn(), cached ? 1500 : 8000);
      if (me) throw redirect({ to: "/" });
    } catch (error) {
      if (cached) throw redirect({ to: "/" });
      if (!isOfflineLikeError(error)) throw error;
      // With no cached session, render sign-in instead of leaving the router
      // skeleton pending forever. A new sign-in still requires connectivity.
    }
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
  const labelClass = bn
    ? "text-xs font-medium text-muted-foreground"
    : "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
  const brandClass = bn
    ? "text-sm font-semibold"
    : "text-[11px] font-display font-bold uppercase tracking-[0.2em]";

  return (
    <div className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-muted/50 px-5 py-10">
      {/* subtle structural backdrop — no glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(120% 70% at 50% 40%, black 30%, transparent 100%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-[23rem] animate-fade-in rounded-[1.25rem] border border-border/70 bg-card/70 p-6 backdrop-blur-xl sm:p-7">
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
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/60 p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              aria-label="Switch to English"
              onClick={() => setLang("en")}
              className={`tap rounded-full px-2.5 py-1 transition-colors ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              EN
            </button>
            <button
              type="button"
              aria-label="বাংলায় পরিবর্তন করুন"
              onClick={() => setLang("bn")}
              className={`tap rounded-full px-2.5 py-1 transition-colors ${bn ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={{ fontFamily: '"Hind Siliguri", sans-serif' }}
            >
              বাংলা
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="mt-8">
          <h1 className="font-display text-[26px] leading-tight tracking-tight">
            {t("auth.signIn")}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("auth.subtitle")}</p>

          <div className="mt-8 space-y-5">
            <div>
              <Label htmlFor="u" className={labelClass}>
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
              <Label htmlFor="p" className={labelClass}>
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
