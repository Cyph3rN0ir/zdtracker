import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createListFn, listListsFn } from "@/lib/notebook.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Notebook } from "lucide-react";

export const Route = createFileRoute("/_app/notebook/lists")({
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
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = title.trim();
          if (v) m.mutate(v);
        }}
        className="rounded-xl border border-border bg-card p-3"
      >
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New list title (e.g. Groceries)"
            className="h-11 text-base"
          />
          <Button type="submit" disabled={!title.trim() || m.isPending} className="h-11 px-4">
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Color</span>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={"h-6 w-6 rounded-full ring-offset-2 ring-offset-card transition-all " + (color === c ? "ring-2 ring-foreground" : "")}
              style={{ background: c }}
            />
          ))}
        </div>
      </form>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (q.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Notebook className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="mt-2 text-sm font-medium">No lists yet</div>
            <div className="text-xs text-muted-foreground mt-1">
              Create one above to start organizing notes and todos.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(q.data ?? []).map((l: any) => (
            <Link
              key={l.id}
              to="/notebook/lists/$listId"
              params={{ listId: l.id }}
              className="group rounded-xl border border-border bg-card p-4 hover:border-foreground/30 transition-colors min-h-[88px] flex flex-col gap-1"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: l.color }}
                  aria-hidden
                />
                <div className="font-semibold truncate">{l.title}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                {l.open_count > 0 ? `${l.open_count} open` : "All done"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
