import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createTodoFn } from "@/lib/notebook.functions";
import { createOfflineId } from "@/lib/offline-queue";
import { OFFLINE_OPS } from "@/lib/offline-operations";
import { useOfflineMutation } from "@/lib/use-offline-mutation";
import { Input } from "@/components/ui/input";
import { ArrowUp } from "lucide-react";

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
  const create = useServerFn(createTodoFn);
  const [value, setValue] = useState("");

  type Input = {
    clientId: string;
    title: string;
    details: string;
    dueDate: string | null;
    listId: string | null;
    noteId: string | null;
    priority: number;
  };
  const m = useOfflineMutation<Input>({
    operation: OFFLINE_OPS.TODO_CREATE,
    mutationFn: (data) => create({ data }),
    affectedKeys: invalidateKeys,
    optimisticUpdate: (client, data) => {
      const now = new Date().toISOString();
      const row = {
        id: data.clientId, list_id: data.listId, note_id: data.noteId,
        title: data.title, details: data.details, due_date: data.dueDate,
        done_at: null, priority: data.priority, sort_order: 0,
        updated_at: now, created_at: now,
      };
      invalidateKeys.forEach((key) =>
        client.setQueryData<Array<typeof row>>(key, (rows) => [...(rows ?? []), row]),
      );
    },
    onSuccess: () => {
      setValue("");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        m.mutate({
          clientId: createOfflineId(), title: v, details: "",
          dueDate: dueDate ?? null, listId: listId ?? null,
          noteId: noteId ?? null, priority: 0,
        });
      }}
      className="sticky bottom-0 z-10 -mx-4 sm:mx-0 sm:rounded-full border-t sm:border border-border/70 bg-background/90 backdrop-blur px-3 py-2"
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 0.5rem)` }}
    >
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-10 text-[15px] border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
          enterKeyHint="done"
        />
        <button
          type="submit"
          disabled={!value.trim() || m.isPending}
          aria-label="Add"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-background disabled:opacity-30 active:scale-95 transition-transform"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
