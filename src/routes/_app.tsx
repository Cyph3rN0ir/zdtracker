import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { logoutFn, meFn } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LayoutDashboard, ListChecks, User, Users, LogOut, Menu, Languages, Palette, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme, THEMES, type Theme } from "@/lib/theme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const me = await meFn();
    if (!me) throw redirect({ to: "/auth" });
    return { me };
  },
  component: AppLayout,
});

function AppLayout() {
  const { me } = Route.useRouteContext();
  const logout = useServerFn(logoutFn);
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const activeTheme = THEMES.find((tt) => tt.id === theme) ?? THEMES[0];

  // close mobile drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  async function doLogout() {
    try { await logout(); } catch {}
    router.invalidate();
    navigate({ to: "/auth" });
  }

  const nav = (
    <>
      <div className="p-5 border-b border-border">
        <div className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {t("brand")}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            {(me.displayName || me.username).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{me.displayName || me.username}</div>
            <Badge variant="secondary" className="mt-0.5 text-[10px] uppercase tracking-wide px-1.5 py-0">
              {me.role}
            </Badge>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 p-3">
        <NavLink to="/" icon={<LayoutDashboard className="h-4 w-4" />}>{t("nav.dashboard")}</NavLink>
        <NavLink to="/my/tasks" icon={<ListChecks className="h-4 w-4" />}>{t("nav.myTasks")}</NavLink>
        <NavLink to="/personal" icon={<User className="h-4 w-4" />}>{t("nav.personal")}</NavLink>
        {me.role === "admin" && (
          <NavLink to="/admin/users" icon={<Users className="h-4 w-4" />}>{t("nav.users")}</NavLink>
        )}
      </nav>

      <Separator className="mt-auto" />
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          <Languages className="h-3.5 w-3.5 mx-1.5 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("bn")}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${lang === "bn" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            style={{ fontFamily: '"Hind Siliguri", sans-serif' }}
          >
            বাংলা
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex gap-0.5">
                {activeTheme.swatch.map((c, i) => (
                  <span key={i} className="h-3 w-3 rounded-sm border border-border" style={{ background: c }} />
                ))}
              </span>
              <span className="truncate flex-1 text-left">{activeTheme.label}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {THEMES.map((th) => (
              <DropdownMenuItem key={th.id} onSelect={() => setTheme(th.id as Theme)} className="gap-2">
                <span className="flex gap-0.5">
                  {th.swatch.map((c, i) => (
                    <span key={i} className="h-3.5 w-3.5 rounded-sm border border-border" style={{ background: c }} />
                  ))}
                </span>
                <span className="flex-1">{th.label}</span>
                {theme === th.id && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" onClick={doLogout} className="w-full justify-start text-muted-foreground">
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr] bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex border-r border-border bg-card flex-col">
        {nav}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[260px] flex flex-col">
            <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle></SheetHeader>
            {nav}
          </SheetContent>
        </Sheet>
        <div className="text-sm font-display font-bold tracking-wide">{t("brand")}</div>
        <div className="h-8 w-8 grid place-items-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
          {(me.displayName || me.username).slice(0, 1).toUpperCase()}
        </div>
      </header>

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl w-full">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors data-[status=active]:bg-accent data-[status=active]:text-foreground data-[status=active]:font-medium"
      activeProps={{ "data-status": "active" } as any}
    >
      {icon}
      {children}
    </Link>
  );
}
