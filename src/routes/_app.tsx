import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { logoutFn, meFn } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LayoutDashboard, ListChecks, MessageSquare, User, Users, LogOut, Menu, Languages, Palette, Check, NotebookPen, Settings } from "lucide-react";
import { useQuery, useQueryClient, onlineManager } from "@tanstack/react-query";
import { unreadTotalFn } from "@/lib/chat.functions";
import { useI18n } from "@/lib/i18n";
import { useTheme, THEMES, type Theme } from "@/lib/theme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PullToRefresh } from "@/components/PullToRefresh";
import { runOfflineWarmup } from "@/lib/offline-warmup";
import { useOfflineStatus } from "@/lib/offline-status";
import { flushQueue, getQueueSize, subscribeQueue } from "@/lib/offline-queue";
import { registerCoreOfflineRunners } from "@/lib/offline-operations";
import { purgePersistedQueryCache } from "@/lib/query-persister";
import { toast } from "sonner";

type CachedMe = {
  userId: string;
  username: string;
  displayName: string;
  role?: "admin" | "owner" | "investor" | "member";
};

type AppMe = Omit<CachedMe, "role"> & { role: "admin" | "owner" | "investor" | "member" };

const ME_CACHE_KEY = "zs:me:v1";

const ROLES = ["admin", "owner", "investor", "member"] as const;

function readCachedMe(): AppMe | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedMe;
    // The cached role only decides which controls are *rendered* while we run
    // on the cached session (offline / meFn unreachable). Every privileged
    // operation is still authorized server-side, so a tampered cache cannot
    // grant access — it would only show buttons whose calls then fail.
    const role = ROLES.includes(cached.role as any) ? (cached.role as AppMe["role"]) : "member";
    return { userId: cached.userId, username: cached.username, displayName: cached.displayName, role };
  } catch {
    return null;
  }
}

function writeCachedMe(me: AppMe) {
  if (typeof window === "undefined") return;
  try {
    const cached: CachedMe = {
      userId: me.userId,
      username: me.username,
      displayName: me.displayName,
      role: me.role,
    };
    window.localStorage.setItem(ME_CACHE_KEY, JSON.stringify(cached));
  } catch {}
}


function isOfflineLikeError(error: unknown) {
  const msg = String((error as any)?.message ?? error).toLowerCase();
  return msg.includes("fetch") || msg.includes("network") || msg.includes("offline") || msg.includes("load failed");
}

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = readCachedMe();
      if (cached) return { me: cached, offline: true };
    }

    let me: AppMe | null = null;
    try {
      me = await meFn();
    } catch (error) {
      const cached = readCachedMe();
      if (cached && isOfflineLikeError(error)) return { me: cached, offline: true };
      throw error;
    }
    if (!me) throw redirect({ to: "/auth" });
    writeCachedMe(me);
    return { me, offline: false };
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

  // Belt-and-braces: close drawer if pathname ever changes (e.g. browser back).
  useEffect(() => { setOpen(false); }, [pathname]);

  // Animate the route content once per section change (e.g. /chat -> /personal,
  // /businesses/$id/money -> /businesses/$id/equity) instead of on every
  // param/search tweak, so typing or filtering never re-triggers the animation.
  const sectionKey = useMemo(() => pathname.split("/").slice(0, 4).join("/"), [pathname]);
  // Chat is a full-height app shell: no outer page scroll, no pull-to-refresh.
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");


  // Phase 2 + 4 — proactive offline warmup, queue flushing, and unified
  // sync-status reporting. Drives the shared OfflineBanner via OfflineStatus.
  const qc = useQueryClient();
  const { setSyncing, setSyncFailed } = useOfflineStatus();
  useEffect(() => {
    if (!me?.userId) return;

    const unregisterRunners = registerCoreOfflineRunners();

    const runWarmup = async () => {
      setSyncing(true);
      setSyncFailed(false);
      try {
        await runOfflineWarmup(qc);
      } catch {
        setSyncFailed(true);
      } finally {
        setSyncing(false);
      }
    };

    const flushPending = async () => {
      if (getQueueSize() === 0) return;
      const res = await flushQueue();
      if (res.ok > 0) {
        toast.success(`Synced ${res.ok} offline change${res.ok === 1 ? "" : "s"}`);
        qc.invalidateQueries();
      }
      if (res.failed) toast.error("Some offline changes failed to sync");
    };

    runWarmup();
    flushPending();

    const unsubOnline = onlineManager.subscribe((online) => {
      if (!online) return;
      runWarmup();
      flushPending();
    });
    const unsubQueue = subscribeQueue(() => {
      // queue changed; nothing to render here — banner reads sync status.
    });
    return () => { unsubOnline(); unsubQueue(); unregisterRunners(); };
  }, [qc, me?.userId, setSyncing, setSyncFailed]);

  // Close drawer BEFORE navigating so the sheet and route transition don't
  // animate at the same time (the main cause of mobile lag).
  const closeDrawer = useCallback(() => setOpen(false), []);

  async function doLogout() {
    try { await logout(); } catch {}
    try {
      window.localStorage.removeItem(ME_CACHE_KEY);
      qc.clear();
      await purgePersistedQueryCache();
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_APP_CACHE" });
    } catch {}
    router.invalidate();
    navigate({ to: "/auth" });
  }

  const unreadQ = useQuery({
    queryKey: ["chat", "unread-total"],
    queryFn: useServerFn(unreadTotalFn),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
  const unreadTotal = unreadQ.data?.total ?? 0;

  // Service-worker push → refresh unread badge in this tab.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "push") {
        qc.invalidateQueries({ queryKey: ["chat", "unread-total"] });
        qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [qc]);

  // Mirror unread count into the OS app-icon badge (where supported).
  useEffect(() => {
    try {
      const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (unreadTotal > 0) nav.setAppBadge?.(unreadTotal);
      else nav.clearAppBadge?.();
    } catch {}
  }, [unreadTotal]);



  const nav = useMemo(() => (
    <>
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div
            className={lang === "bn"
              ? "text-sm font-semibold text-muted-foreground"
              : "text-[11px] font-display font-bold uppercase tracking-[0.18em] text-muted-foreground"}
            style={lang === "bn" ? { fontFamily: '"Hind Siliguri", sans-serif' } : undefined}
          >
            {t("brand")}
          </div>
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
        <NavLink to="/" onNavigate={closeDrawer} icon={<LayoutDashboard className="h-4 w-4" />}>{t("nav.dashboard")}</NavLink>
        <NavLink to="/my/tasks" onNavigate={closeDrawer} icon={<ListChecks className="h-4 w-4" />}>{t("nav.myTasks")}</NavLink>
        <NavLink to="/notebook/today" onNavigate={closeDrawer} icon={<NotebookPen className="h-4 w-4" />}>{t("nav.notebook")}</NavLink>

        <NavLink to="/chat" onNavigate={closeDrawer} icon={<MessageSquare className="h-4 w-4" />} badge={unreadTotal}>Chat</NavLink>
        <NavLink to="/personal" onNavigate={closeDrawer} icon={<User className="h-4 w-4" />}>{t("nav.personal")}</NavLink>
        <NavLink to="/settings" onNavigate={closeDrawer} icon={<Settings className="h-4 w-4" />}>Settings</NavLink>
        {me.role === "admin" && (
          <NavLink to="/admin/users" onNavigate={closeDrawer} icon={<Users className="h-4 w-4" />}>{t("nav.users")}</NavLink>
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
              className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
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
  ), [me, t, lang, setLang, theme, setTheme, activeTheme, closeDrawer, unreadTotal]);

  return (
    /*
     * Outer wrapper uses flex-col on mobile so the header and content
     * stack naturally. flex-1 + min-h-0 on the content fills whatever
     * space remains — no hardcoded calc() needed, works on any device.
     * On desktop it switches to a 2-col grid as before.
     */
    <div className={`bg-muted/30 flex flex-col md:grid md:grid-cols-[240px_1fr] ${
      isChat ? "h-dvh overflow-hidden" : "min-h-dvh"
    }`}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex border-r border-border bg-card flex-col">
        {nav}
      </aside>

      {/* Mobile top bar — shrinks to its natural height (includes safe-area-top padding).
          The padding-top pushes it below the Android / iOS system status bar. */}
      <header
        className="md:hidden shrink-0 sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-card/85 supports-[backdrop-filter]:bg-card/70 backdrop-blur-xl px-3 py-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.5rem)' }}
      >
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="tap">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          {/* Sheet content also gets safe-area top so the user card
              doesn’t overlap the status bar when the drawer is open */}
          <SheetContent
            side="left"
            className="pwa-sheet p-0 w-[260px] flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle></SheetHeader>
            {nav}
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div
            className={lang === "bn" ? "text-sm font-semibold" : "text-sm font-display font-bold tracking-wide"}
            style={lang === "bn" ? { fontFamily: '"Hind Siliguri", sans-serif' } : undefined}
          >
            {t("brand")}
          </div>
        </div>
        <div className="h-8 w-8 grid place-items-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
          {(me.displayName || me.username).slice(0, 1).toUpperCase()}
        </div>
      </header>

      {/* Main content area — flex-1 + min-h-0 fills exactly the remaining height
          after the header, regardless of how tall the header is.
          For chat: overflow-hidden keeps the inner scroll contained.
          For other pages: normal scroll with pb-safe bottom breathing room. */}
      {isChat ? (
        <main className="flex-1 min-h-0 w-full overflow-hidden md:h-dvh">
          <Outlet />
        </main>
      ) : (
        <main className="pwa-scroll p-4 sm:p-6 md:p-8 max-w-7xl w-full pb-safe">
          <PullToRefresh>
            {/* Keyed on the top-level section so switching pages/tabs animates in
                once, without re-animating on in-page param changes. */}
            <div key={sectionKey} className="page-in">
              <Outlet />
            </div>
          </PullToRefresh>
        </main>
      )}

      {/* Unified offline/sync indicator is mounted in __root via OfflineBanner. */}
    </div>
  );
}

function NavLink({ to, icon, children, onNavigate, badge }: { to: string; icon: React.ReactNode; children: React.ReactNode; onNavigate?: () => void; badge?: number }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      onClick={onNavigate}
      className="tap relative flex items-center gap-2.5 overflow-hidden rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground data-[status=active]:font-medium before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:scale-y-0 before:rounded-r-full before:bg-primary before:transition-transform before:duration-200 data-[status=active]:before:scale-y-100"
      activeProps={{ "data-status": "active" } as any}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {badge && badge > 0 ? (
        <Badge className="h-5 min-w-5 px-1.5 text-[10px]">{badge > 99 ? "99+" : badge}</Badge>
      ) : null}
    </Link>
  );
}

