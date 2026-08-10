import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
import { createOfflineId } from "@/lib/offline-queue";
import { OFFLINE_OPS } from "@/lib/offline-operations";
import { removeRow, updateRows, useOfflineMutation } from "@/lib/use-offline-mutation";
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

  const [renaming, setRenaming] = useState(false);
  const mRename = useOfflineMutation<{ id: string; title: string }>({
    operation: OFFLINE_OPS.LIST_UPDATE,
    mutationFn: (data) => updateList({ data }),
    affectedKeys: [["notebook", "lists"]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: (client, data) =>
      client.setQueryData<any[]>(["notebook", "lists"], (rows) =>
        updateRows(rows, data.id, (row) => ({ ...row, title: data.title })),
      ),
    onSuccess: () => {
      setRenaming(false);
    },
  });
  const mDeleteList = useOfflineMutation<{ id: string }>({
    operation: OFFLINE_OPS.LIST_DELETE,
    mutationFn: (data) => deleteList({ data }),
    affectedKeys: [["notebook", "lists"]],
    optimisticUpdate: (client, data) =>
      client.setQueryData<any[]>(["notebook", "lists"], (rows) => removeRow(rows, data.id)),
    onSuccess: () => {
      nav({ to: "/notebook/lists" });
    },
  });

  const mNewNote = useOfflineMutation<{ clientId: string; listId: string; title: string; body_md: string }>({
    operation: OFFLINE_OPS.NOTE_UPSERT,
    mutationFn: (data) => upsertNote({ data }),
    affectedKeys: [["notebook", "notes", listId]],
    optimisticUpdate: (client, data) => {
      const now = new Date().toISOString();
      const row = {
        id: data.clientId, list_id: data.listId, title: data.title,
        body_md: data.body_md, pinned: false, updated_at: now, created_at: now,
      };
      client.setQueryData<any[]>(["notebook", "notes", listId], (rows) => [row, ...(rows ?? [])]);
      client.setQueryData(["notebook", "note", data.clientId], row);
    },
    onSuccess: (_result, data) => {
      nav({ to: "/notebook/notes/$noteId", params: { noteId: data.clientId } });
    },
  });

  const mTogglePin = useOfflineMutation<{ id: string; pinned: boolean }>({
    operation: OFFLINE_OPS.NOTE_PIN,
    mutationFn: (data) => togglePin({ data }),
    affectedKeys: [["notebook", "notes", listId]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: (client, data) =>
      client.setQueryData<any[]>(["notebook", "notes", listId], (rows) =>
        updateRows(rows, data.id, (row) => ({ ...row, pinned: data.pinned })),
      ),
  });

  const allTodos = (todos.data ?? []) as Todo[];
  const openTodos = allTodos.filter((t) => !t.done_at);
  const doneTodos = allTodos.filter((t) => !!t.done_at);

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Slim title bar */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-3">
        <Link
          to="/notebook/lists"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Back to lists"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: list?.color || "#888" }} aria-hidden />
        {renaming ? (
          <Input
            autoFocus
            defaultValue={list?.title || ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== list?.title) mRename.mutate({ id: listId, title: v });
              else setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="h-8 min-w-0 border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-lg font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="min-w-0 flex-1 text-left text-lg font-semibold tracking-tight truncate hover:underline underline-offset-4 decoration-muted-foreground/40"
          >
            {list?.title || "List"}
          </button>
        )}
        <button
          type="button"
          aria-label="Delete list"
          onClick={() => {
            if (confirm("Delete this list? Notes and todos inside will be unlinked but kept.")) mDeleteList.mutate({ id: listId });
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Notes */}
      <section>
        <div className="flex items-baseline justify-between border-b border-border/50 pb-1.5 mb-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Notes
          </h2>
          <button
            onClick={() => mNewNote.mutate({ clientId: createOfflineId(), listId, title: "Untitled", body_md: "" })}
            disabled={mNewNote.isPending}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <StickyNote className="h-3 w-3" /> New
          </button>
        </div>
        {(notes.data?.length ?? 0) === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground/70">
            No notes in this list.
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {(notes.data ?? []).map((n: any) => (
              <li key={n.id} className="group flex items-start gap-2 py-2.5">
                <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                <Link
                  to="/notebook/notes/$noteId"
                  params={{ noteId: n.id }}
                  className="min-w-0 flex-1"
                >
                  <div className="text-[14px] font-medium truncate">{n.title || "Untitled"}</div>
                  {n.body_md && (
                    <div className="text-[11px] text-muted-foreground/80 mt-0.5 line-clamp-1">
                      {n.body_md.slice(0, 200)}
                    </div>
                  )}
                </Link>
                <button
                  type="button"
                  aria-label={n.pinned ? "Unpin" : "Pin"}
                  onClick={() => mTogglePin.mutate({ id: n.id, pinned: !n.pinned })}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-accent opacity-60 group-hover:opacity-100 transition-opacity"
                >
                  {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Todos */}
      <section>
        <div className="flex items-baseline justify-between border-b border-border/50 pb-1.5 mb-1">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Todos
          </h2>
          {openTodos.length > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground/70">{openTodos.length} open</span>
          )}
        </div>
        {openTodos.length === 0 && doneTodos.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground/70">
            No todos. Add one below.
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {openTodos.map((t) => (
              <TodoRow key={t.id} t={t} invalidateKeys={invalidateTodos} />
            ))}
            {doneTodos.length > 0 && (
              <li className="pt-3 pb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                Done · {doneTodos.length}
              </li>
            )}
            {doneTodos.map((t) => (
              <TodoRow key={t.id} t={t} invalidateKeys={invalidateTodos} />
            ))}
          </ul>
        )}
      </section>

      <QuickAdd listId={listId} invalidateKeys={invalidateTodos} placeholder="Add a task to this list…" />
    </div>
  );
}
