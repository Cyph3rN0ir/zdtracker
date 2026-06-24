import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toggleTodoFn, deleteTodoFn, updateTodoFn } from "@/lib/notebook.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";

export type Todo = {
  id: string;
  list_id: string | null;
  note_id: string | null;
  title: string;
  details: string;
  due_date: string | null;
  done_at: string | null;
  priority: number;
};

const PRI_LABEL = ["", "Low", "Med", "High"];
const PRI_CLASS = ["", "bg-muted text-muted-foreground", "bg-amber-500/15 text-amber-700 dark:text-amber-300", "bg-red-500/15 text-red-700 dark:text-red-300"];

export function TodoRow({
  t,
  invalidateKeys,
  showListBadge,
  listTitle,
}: {
  t: Todo;
  invalidateKeys: any[][];
  showListBadge?: boolean;
  listTitle?: string;
}) {
  const qc = useQueryClient();
  const toggle = useServerFn(toggleTodoFn);
  const remove = useServerFn(deleteTodoFn);
  const update = useServerFn(updateTodoFn);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);

  const refetch = () => invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const mToggle = useMutation({
    mutationFn: (done: boolean) => toggle({ data: { id: t.id, done } }),
    onSuccess: refetch,
  });
  const mDelete = useMutation({
    mutationFn: () => remove({ data: { id: t.id } }),
    onSuccess: refetch,
  });
  const mRename = useMutation({
    mutationFn: (newTitle: string) => update({ data: { id: t.id, title: newTitle } }),
    onSuccess: () => {
      setEditing(false);
      refetch();
    },
  });

  const done = !!t.done_at;

  return (
    <li className="group flex items-start gap-3 px-2 py-2.5 min-h-[44px]">
      <Checkbox
        checked={done}
        onCheckedChange={(c) => mToggle.mutate(!!c)}
        className="mt-0.5 h-5 w-5"
      />
      <div className="flex-1 min-w-0">
        {editing ? (
          <Input
            autoFocus
            defaultValue={t.title}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== t.title) mRename.mutate(v);
              else setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-8"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={
              "block w-full text-left text-sm " +
              (done ? "line-through text-muted-foreground" : "font-medium text-foreground")
            }
          >
            {t.title}
          </button>
        )}
        {t.details && !editing && (
          <div className="text-xs text-muted-foreground mt-0.5 break-words">{t.details}</div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {t.priority > 0 && (
            <Badge variant="secondary" className={"text-[10px] px-1.5 py-0 " + PRI_CLASS[t.priority]}>
              {PRI_LABEL[t.priority]}
            </Badge>
          )}
          {showListBadge && listTitle && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{listTitle}</Badge>
          )}
          {t.due_date && (
            <span className="text-[10px] font-mono text-muted-foreground">{t.due_date}</span>
          )}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 transition-opacity">
        <button
          type="button"
          aria-label="Edit"
          onClick={() => setEditing(true)}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Delete"
          onClick={() => {
            if (confirm("Delete this todo?")) mDelete.mutate();
          }}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
