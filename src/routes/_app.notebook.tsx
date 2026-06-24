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
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h1 className="truncate text-xl sm:text-2xl font-display font-bold tracking-tight">Notebook</h1>
      </div>
      <div className="sticky top-[52px] md:top-0 z-30 -mx-4 sm:mx-0 bg-muted/30 sm:bg-transparent px-4 sm:px-0 py-1 sm:py-0">
        <div className="inline-flex w-full sm:w-auto rounded-lg border border-border bg-card p-1 text-sm">
          <Link
            to="/notebook/today"
            className={
              "flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 sm:py-1.5 transition-colors min-h-[40px] " +
              (tab === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            <CalendarCheck2 className="h-4 w-4 shrink-0" /> <span className="truncate">Today</span>
          </Link>
          <Link
            to="/notebook/lists"
            className={
              "flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 sm:py-1.5 transition-colors min-h-[40px] " +
              (tab === "lists" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            <FolderKanban className="h-4 w-4 shrink-0" /> <span className="truncate">Lists & notes</span>
          </Link>
        </div>
      </div>
      <Outlet />
    </div>
  );
}

