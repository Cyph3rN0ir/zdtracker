import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/notebook")({
  component: NotebookLayout,
  head: () => ({ meta: [{ title: "Notebook — ZeroSync" }] }),
});

function NotebookLayout() {
  const loc = useLocation();
  const tab = loc.pathname.startsWith("/notebook/lists") ? "lists" : "today";
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="truncate font-display text-xl sm:text-2xl font-semibold tracking-tight">
          Notebook
        </h1>
      </div>
      <div className="sticky top-[52px] md:top-0 z-30 -mx-4 sm:mx-0 bg-background/85 backdrop-blur px-4 sm:px-0">
        <div className="flex items-center gap-6 border-b border-border/60 text-sm">
          <TabLink to="/notebook/today" active={tab === "today"} label="Today" />
          <TabLink to="/notebook/lists" active={tab === "lists"} label="Lists & notes" />
        </div>
      </div>
      <Outlet />
    </div>
  );
}

function TabLink({ to, active, label }: { to: string; active: boolean; label: string }) {
  return (
    <Link
      to={to}
      className={
        "relative -mb-px py-2.5 transition-colors " +
        (active
          ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-foreground"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </Link>
  );
}
