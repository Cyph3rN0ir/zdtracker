import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listListsFn,
  listNotesFn,
  listTodosFn,
  upsertNoteFn,
  updateListFn,
  deleteListFn,
  togglePinNoteFn,
} from "@/lib/notebook.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TodoRow, type Todo } from "@/components/notebook/TodoRow";
import { QuickAdd } from "@/components/notebook/QuickAdd";
import { ChevronLeft, FileText, Pin, PinOff, Trash2, StickyNote } from "lucide-react";

export const Route = createFileRoute("/_app/notebook/lists/$listId")({
  component: ListPage,
  head: () => ({ meta: [{ title: "List — Notebook — ZeroSync" }] }),
});

function ListPage() {
  const { listId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const listLists = useServerFn(listListsFn);
  const listNotes = useServerFn(listNotesFn);
  const listTodos = useServerFn(listTodosFn);
  const upsertNote = useServerFn(upsertNoteFn);
  const updateList = useServerFn(updateListFn);
  const deleteList = useServerFn(deleteListFn);
  const togglePin = useServerFn(togglePinNoteFn);

  const lists = useQuery({ queryKey: ["notebook", "lists"], queryFn: () => listLists() });
  const list = (lists.data ?? []).find((l: any) => l.id === listId);

  const notes = useQuery({
    queryKey: ["notebook", "notes", listId],
    queryFn: () => listNotes({ data: { listId } }),
  });
  const todos = useQuery({
    queryKey: ["notebook", "list-todos", listId],
    queryFn: () => listTodos({ data: { listId, includeUnscheduled: true } }),
  });

  const invalidateTodos = [["notebook", "list-todos", listId]];
  const invalidateNotes = [["notebook", "notes", listId]];

  const [renaming, setRenaming] = useState(false);
  const mRename = useMutation({
    mutationFn: (title: string) => updateList({ data: { id: listId, title } }),
    onSuccess: () => {
      setRenaming(false);
      qc.invalidateQueries({ queryKey: ["notebook", "lists"] });
    },
  });
  const mDeleteList = useMutation({
    mutationFn: () => deleteList({ data: { id: listId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notebook", "lists"] });
      nav({ to: "/notebook/lists" });
    },
  });

  const mNewNote = useMutation({
    mutationFn: () => upsertNote({ data: { listId, title: "Untitled", body_md: "" } }),
    onSuccess: (row: any) => {
      qc.invalidateQueries({ queryKey: ["notebook", "notes", listId] });
      nav({ to: "/notebook/notes/$noteId", params: { noteId: row.id } });
    },
  });

  const mTogglePin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => togglePin({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebook", "notes", listId] }),
  });

  const allTodos = (todos.data ?? []) as Todo[];
  const openTodos = allTodos.filter((t) => !t.done_at);
  const doneTodos = allTodos.filter((t) => !!t.done_at);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2">
        <Link
          to="/notebook/lists"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md hover:bg-accent"
          aria-label="Back to lists"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: list?.color || "#888" }} aria-hidden />
        {renaming ? (
          <Input
            autoFocus
            defaultValue={list?.title || ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== list?.title) mRename.mutate(v);
              else setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="h-10 min-w-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="min-w-0 text-left text-lg font-semibold truncate hover:underline"
          >
            {list?.title || "List"}
          </button>
        )}
        <button
          type="button"
          aria-label="Delete list"
          onClick={() => {
            if (confirm("Delete this list? Notes and todos inside will be unlinked but kept.")) mDeleteList.mutate();
          }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Notes */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h2>
          <Button size="sm" variant="secondary" onClick={() => mNewNote.mutate()} disabled={mNewNote.isPending}>
            <StickyNote className="h-4 w-4 mr-1" /> New note
          </Button>
        </div>
        {(notes.data?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-xs text-muted-foreground">
              No notes in this list.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(notes.data ?? []).map((n: any) => (
              <div key={n.id} className="rounded-xl border border-border bg-card hover:border-foreground/30 transition-colors">
                <Link
                  to="/notebook/notes/$noteId"
                  params={{ noteId: n.id }}
                  className="block p-3"
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="text-sm font-medium truncate">{n.title || "Untitled"}</div>
                  </div>
                  {n.body_md && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                      {n.body_md.slice(0, 200)}
                    </div>
                  )}
                </Link>
                <div className="flex items-center justify-end gap-1 px-2 pb-1.5">
                  <button
                    type="button"
                    aria-label={n.pinned ? "Unpin" : "Pin"}
                    onClick={() => mTogglePin.mutate({ id: n.id, pinned: !n.pinned })}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                  >
                    {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Todos */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Todos</h2>
        <Card>
          <ul className="divide-y divide-border px-2 py-1">
            {openTodos.length === 0 && doneTodos.length === 0 ? (
              <li className="px-2 py-6 text-center text-xs text-muted-foreground">
                No todos. Add one below.
              </li>
            ) : (
              <>
                {openTodos.map((t) => (
                  <TodoRow key={t.id} t={t} invalidateKeys={invalidateTodos} />
                ))}
                {doneTodos.length > 0 && (
                  <li className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Done ({doneTodos.length})
                  </li>
                )}
                {doneTodos.map((t) => (
                  <TodoRow key={t.id} t={t} invalidateKeys={invalidateTodos} />
                ))}
              </>
            )}
          </ul>
        </Card>
      </section>

      <QuickAdd listId={listId} invalidateKeys={invalidateTodos} placeholder="Add a task to this list…" />
    </div>
  );
}
