import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logoutFn, meFn } from "@/lib/auth.functions";

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
    } catch {
      // logout throws redirect — ignore
    }
    router.invalidate();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr]">
      <aside className="border-r border-border bg-sidebar p-4 flex flex-col">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">ZeroTrack</div>
          <div className="text-sm font-semibold mt-1">{me.displayName || me.username}</div>
          <div className="text-[11px] text-muted-foreground uppercase">{me.role}</div>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/my/tasks">My tasks</NavLink>
          <NavLink to="/personal">Personal</NavLink>
          {me.role === "admin" && <NavLink to="/admin/users">Users</NavLink>}
        </nav>
        <div className="mt-auto">
          <button
            onClick={doLogout}
            className="w-full text-left text-xs text-muted-foreground hover:text-foreground py-2"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="p-8 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="px-2 py-1.5 text-foreground hover:bg-accent data-[status=active]:bg-accent data-[status=active]:font-medium"
      activeProps={{ "data-status": "active" } as any}
    >
      {children}
    </Link>
  );
}
