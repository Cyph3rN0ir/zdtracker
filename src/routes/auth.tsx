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

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("brand")}
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <button type="button" onClick={() => setLang("en")}
                className={`rounded px-2 py-0.5 text-[10px] font-medium ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>EN</button>
              <button type="button" onClick={() => setLang("bn")}
                className={`rounded px-2 py-0.5 text-[10px] font-medium ${lang === "bn" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                style={{ fontFamily: '"Hind Siliguri", sans-serif' }}>বাংলা</button>
            </div>
          </div>
          <CardTitle className="font-display text-2xl">{t("auth.signIn")}</CardTitle>
          <CardDescription>{t("auth.subtitle")}</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u">{t("auth.username")}</Label>
              <Input id="u" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">{t("auth.password")}</Label>
              <Input id="p" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
