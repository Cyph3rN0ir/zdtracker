import { memo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toggleTodoFn, deleteTodoFn, updateTodoFn } from "@/lib/notebook.functions";
import { Checkbox } from "@/components/ui/checkbox";
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
const PRI_DOT = ["", "bg-muted-foreground/40", "bg-amber-500", "bg-red-500"];

export const TodoRow = memo(function TodoRow({
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
    <li className="group flex items-start gap-3 px-1 py-2 min-h-[40px]">
      <Checkbox
        checked={done}
        onCheckedChange={(c) => mToggle.mutate(!!c)}
        className="mt-[3px] h-4 w-4 rounded-[4px]"
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
            className="h-8 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={
              "block w-full text-left text-[13px] leading-snug " +
              (done ? "line-through text-muted-foreground" : "text-foreground")
            }
          >
            {t.title}
          </button>
        )}
        {t.details && !editing && (
          <div className="text-[11px] text-muted-foreground/80 mt-0.5 break-words">{t.details}</div>
        )}
        {(t.priority > 0 || (showListBadge && listTitle) || t.due_date) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/80">
            {t.priority > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className={"h-1.5 w-1.5 rounded-full " + PRI_DOT[t.priority]} />
                {PRI_LABEL[t.priority]}
              </span>
            )}
            {showListBadge && listTitle && <span className="truncate">· {listTitle}</span>}
            {t.due_date && <span className="tabular-nums">· {t.due_date}</span>}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          aria-label="Edit"
          onClick={() => setEditing(true)}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Delete"
          onClick={() => {
            if (confirm("Delete this todo?")) mDelete.mutate();
          }}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
});
