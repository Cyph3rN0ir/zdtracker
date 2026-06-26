import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createListFn, listListsFn } from "@/lib/notebook.functions";
import { Input } from "@/components/ui/input";
import { Plus, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/notebook/lists/")({
  component: ListsPage,
  head: () => ({ meta: [{ title: "Lists — Notebook — ZeroSync" }] }),
});

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];

function ListsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listListsFn);
  const create = useServerFn(createListFn);
  const q = useQuery({ queryKey: ["notebook", "lists"], queryFn: () => list() });
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const m = useMutation({
    mutationFn: (t: string) => create({ data: { title: t, color } }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["notebook", "lists"] });
    },
  });

  return (
    <div className="space-y-5">
      {/* Inline composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = title.trim();
          if (v) m.mutate(v);
        }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 border-b border-border/60 pb-2 focus-within:border-foreground/40 transition-colors">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: color }}
            aria-hidden
          />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New list…"
            className="h-9 min-w-0 flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-[15px]"
          />
          <button
            type="submit"
            disabled={!title.trim() || m.isPending}
            aria-label="Create list"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 pl-4">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={
                "h-3.5 w-3.5 rounded-full transition-transform " +
                (color === c ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/70 scale-110" : "opacity-60 hover:opacity-100")
              }
              style={{ background: c }}
            />
          ))}
        </div>
      </form>

      {q.isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (q.data?.length ?? 0) === 0 ? (
        <div className="py-14 text-center text-xs text-muted-foreground/80">
          No lists yet. Create one above.
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {(q.data ?? []).map((l: any) => (
            <li key={l.id}>
              <Link
                to="/notebook/lists/$listId"
                params={{ listId: l.id }}
                className="group flex items-center gap-3 py-3 hover:bg-accent/40 -mx-2 px-2 rounded-md transition-colors"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: l.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                  {l.title}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {l.open_count > 0 ? l.open_count : "—"}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
