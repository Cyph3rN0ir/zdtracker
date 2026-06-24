import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createTodoFn } from "@/lib/notebook.functions";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

/** Bottom-anchored quick-add bar. Safe-area aware. */
export function QuickAdd({
  dueDate,
  listId,
  noteId,
  invalidateKeys,
  placeholder = "Add a task…",
}: {
  dueDate?: string | null;
  listId?: string | null;
  noteId?: string | null;
  invalidateKeys: any[][];
  placeholder?: string;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createTodoFn);
  const [value, setValue] = useState("");

  const m = useMutation({
    mutationFn: (title: string) =>
      create({
        data: {
          title,
          details: "",
          dueDate: dueDate ?? null,
          listId: listId ?? null,
          noteId: noteId ?? null,
          priority: 0,
        },
      }),
    onSuccess: () => {
      setValue("");
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        m.mutate(v);
      }}
      className="sticky bottom-0 z-10 -mx-4 sm:mx-0 sm:rounded-xl border-t sm:border border-border bg-card/95 backdrop-blur px-3 py-2"
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 0.5rem)` }}
    >
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-11 text-base"
          enterKeyHint="done"
        />
        <button
          type="submit"
          disabled={!value.trim() || m.isPending}
          aria-label="Add"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-50 active:scale-95 transition-transform"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
