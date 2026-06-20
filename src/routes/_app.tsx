import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logoutFn, meFn } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, ListChecks, User, Users, LogOut } from "lucide-react";

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

  async function doLogout() {
    try {
      await logout();
    } catch {}
    router.invalidate();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[240px_1fr] bg-muted/30">
      <aside className="border-r border-border bg-card flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-muted-foreground">
            ZeroTrack
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
          <NavLink to="/" icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</NavLink>
          <NavLink to="/my/tasks" icon={<ListChecks className="h-4 w-4" />}>My tasks</NavLink>
          <NavLink to="/personal" icon={<User className="h-4 w-4" />}>Personal</NavLink>
          {me.role === "admin" && (
            <NavLink to="/admin/users" icon={<Users className="h-4 w-4" />}>Users</NavLink>
          )}
        </nav>

        <Separator className="mt-auto" />
        <div className="p-3">
          <Button variant="ghost" size="sm" onClick={doLogout} className="w-full justify-start text-muted-foreground">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="p-6 md:p-8 max-w-7xl w-full">
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
