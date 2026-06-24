import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { CalendarCheck2, FolderKanban } from "lucide-react";

export const Route = createFileRoute("/_app/notebook")({
  component: NotebookLayout,
  head: () => ({ meta: [{ title: "Notebook — ZeroSync" }] }),
});

function NotebookLayout() {
  const loc = useLocation();
  const tab = loc.pathname.startsWith("/notebook/lists") ? "lists" : "today";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-display font-bold tracking-tight">Notebook</h1>
      </div>
      <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
        <Link
          to="/notebook/today"
          className={
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors " +
            (tab === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
          }
        >
          <CalendarCheck2 className="h-4 w-4" /> Today
        </Link>
        <Link
          to="/notebook/lists"
          className={
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors " +
            (tab === "lists" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
          }
        >
          <FolderKanban className="h-4 w-4" /> Lists & notes
        </Link>
      </div>
      <Outlet />
    </div>
  );
}

