import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getBusinessFn } from "@/lib/zt.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_app/businesses/$id")({
  component: BusinessLayout,
});

const TABS = [
  { key: "overview", label: "Overview", to: "/businesses/$id" },
  { key: "people", label: "People", to: "/businesses/$id/people" },
  { key: "money", label: "Money", to: "/businesses/$id/money" },
  { key: "profit", label: "Profit", to: "/businesses/$id/profit" },
  { key: "tasks", label: "Tasks", to: "/businesses/$id/tasks" },
] as const;

function BusinessLayout() {
  const { id } = Route.useParams();
  const get = useServerFn(getBusinessFn);
  const q = useQuery({ queryKey: ["business", id], queryFn: () => get({ data: { id } }) });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const active =
    TABS.slice()
      .reverse()
      .find((t) => pathname.startsWith(t.to.replace("$id", id)))?.key ?? "overview";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
          <Link to="/">
            <ChevronLeft className="h-3.5 w-3.5" />
            All businesses
          </Link>
        </Button>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          {q.data?.name ?? "…"}
        </h1>
        <Tabs value={active}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} asChild>
                <Link to={t.to} params={{ id }}>{t.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <Outlet />
    </div>
  );
}
