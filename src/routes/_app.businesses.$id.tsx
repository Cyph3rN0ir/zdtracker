import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getBusinessFn } from "@/lib/zt.functions";

export const Route = createFileRoute("/_app/businesses/$id")({
  component: BusinessLayout,
});

function BusinessLayout() {
  const { id } = Route.useParams();
  const get = useServerFn(getBusinessFn);
  const q = useQuery({ queryKey: ["business", id], queryFn: () => get({ data: { id } }) });

  return (
    <div>
      <div className="border-b border-border pb-4 mb-6">
        <Link to="/" className="text-xs text-muted-foreground hover:underline">← All businesses</Link>
        <h1 className="text-xl font-semibold tracking-tight mt-2">{q.data?.name ?? "…"}</h1>
        <nav className="flex gap-1 mt-4 text-sm">
          <Tab to="/businesses/$id" params={{ id }} exact>Overview</Tab>
          <Tab to="/businesses/$id/people" params={{ id }}>People</Tab>
          <Tab to="/businesses/$id/money" params={{ id }}>Money</Tab>
          <Tab to="/businesses/$id/profit" params={{ id }}>Profit</Tab>
          <Tab to="/businesses/$id/tasks" params={{ id }}>Tasks</Tab>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

function Tab({ to, params, exact, children }: any) {
  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact: !!exact }}
      className="px-3 py-1.5 border border-transparent hover:bg-accent data-[status=active]:border-border data-[status=active]:bg-background data-[status=active]:font-medium"
      activeProps={{ "data-status": "active" } as any}
    >
      {children}
    </Link>
  );
}
