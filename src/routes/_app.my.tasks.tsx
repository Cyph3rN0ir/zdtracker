import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { myTasksFn, toggleTaskFn, deleteTaskFn, setTaskRemarkFn } from "@/lib/zt.functions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBox } from "@/components/ErrorBox";
import { Checkbox } from "@/components/ui/checkbox";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { OFFLINE_OPS } from "@/lib/offline-operations";
import { removeRow, updateRows, useOfflineMutation } from "@/lib/use-offline-mutation";

type Task = {
  id: string;
  business_id: string;
  title: string;
  details: string | null;
  due_date: string;
  status: string;
  created_by: string | null;
  remark: string | null;
  remark_at: string | null;
};

export const Route = createFileRoute("/_app/my/tasks")({
  component: MyTasks,
  head: () => ({ meta: [{ title: "My tasks — ZeroSync" }] }),
});

function MyTasks() {
  const list = useServerFn(myTasksFn);
  const toggle = useServerFn(toggleTaskFn);
  const del = useServerFn(deleteTaskFn);
  const setRemark = useServerFn(setTaskRemarkFn);

  const q = useQuery({ queryKey: ["my-tasks"], queryFn: () => list() });

  const toggleM = useOfflineMutation<{ id: string; done: boolean }>({
    operation: OFFLINE_OPS.TASK_TOGGLE,
    mutationFn: (data) => toggle({ data }),
    affectedKeys: [["my-tasks"], ["tasks"]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: (client, data) => {
      const update = (rows: Task[] | undefined) =>
        updateRows(rows, data.id, (row) => ({ ...row, status: data.done ? "done" : "pending" }));
      client.setQueryData<Task[]>(["my-tasks"], update);
      client.setQueriesData<Task[]>({ queryKey: ["tasks"] }, update);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update task"),
  });
  const deleteM = useOfflineMutation<{ id: string }>({
    operation: OFFLINE_OPS.TASK_DELETE,
    mutationFn: (data) => del({ data }),
    affectedKeys: [["my-tasks"], ["tasks"]],
    optimisticUpdate: (client, data) => {
      client.setQueryData<Task[]>(["my-tasks"], (rows) => removeRow(rows, data.id));
      client.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (rows) => removeRow(rows, data.id));
    },
    onSuccess: (result) => toast.success(result.queued ? "Deletion saved offline" : "Task deleted"),
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete task"),
  });
  const remarkM = useOfflineMutation<{ id: string; remark: string }>({
    operation: OFFLINE_OPS.TASK_REMARK,
    mutationFn: (data) => setRemark({ data }),
    affectedKeys: [["my-tasks"], ["tasks"]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: (client, data) => {
      const update = (rows: Task[] | undefined) =>
        updateRows(rows, data.id, (row) => ({
          ...row, remark: data.remark.trim() || null,
          remark_at: data.remark.trim() ? new Date().toISOString() : null,
        }));
      client.setQueryData<Task[]>(["my-tasks"], update);
      client.setQueriesData<Task[]>({ queryKey: ["tasks"] }, update);
    },
    onSuccess: (result) => toast.success(result.queued ? "Remark saved offline" : "Remark saved"),
    onError: (e: any) => toast.error(e?.message ?? "Failed to save remark"),
  });

  const [remarkFor, setRemarkFor] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const tasks: Task[] = (q.data ?? []) as Task[];
  const groups: Record<string, Task[]> = {};
  tasks.forEach((t) => { (groups[t.due_date] = groups[t.due_date] || []).push(t); });
  const days = Object.keys(groups).sort();

  return (
    <div className="space-y-6">
      <PageHeader title="My tasks" subtitle="Your assignments for the next 14 days." />
      {q.isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : q.isError && !q.data && !q.isFetching ? (
        <ErrorBox error={q.error} />
      ) : days.length === 0 ? (
        <EmptyState message="No tasks assigned." />
      ) : (
        <div className="space-y-7">
          {days.map((d) => {
            const open = groups[d].filter((t) => t.status !== "done").length;
            const isOverdue = d < today;
            return (
              <section key={d}>
                <div className="flex items-baseline justify-between border-b border-border/50 pb-1.5 mb-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <h3 className={"text-[11px] font-medium uppercase tracking-[0.14em] " + (isOverdue ? "text-destructive" : "text-muted-foreground")}>
                      {formatDay(d, today)}
                    </h3>
                    <span className="text-[10px] font-mono text-muted-foreground/60">{d}</span>
                  </div>
                  <span className={"text-[11px] tabular-nums " + (isOverdue ? "text-destructive/80" : "text-muted-foreground/70")}>
                    {isOverdue ? `${open} due` : open === 0 ? "all done" : `${open} open`}
                  </span>
                </div>
                <ul className="divide-y divide-border/40">
                  {groups[d].map((t) => (
                    <li key={t.id} className="cv-auto group flex items-start gap-3 px-1 py-2.5 min-h-[40px]">
                      <Checkbox
                        checked={t.status === "done"}
                        onCheckedChange={(c) => toggleM.mutate({ id: t.id, done: !!c })}
                        className="mt-[3px] h-4 w-4 rounded-[4px]"
                        aria-label={t.status === "done" ? "Mark as not done" : "Mark as done"}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={"text-[13px] leading-snug " + (t.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}>
                          {t.title}
                        </div>
                        {t.details && <div className="text-[11px] text-muted-foreground/80 mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">{t.details}</div>}
                        {t.remark && (
                          <div className="mt-1.5 border-l-2 border-amber-500/60 bg-amber-500/5 pl-2 py-1 text-[11px] text-amber-900 dark:text-amber-200">
                            <div className="font-medium text-[9px] uppercase tracking-[0.14em] opacity-70">Remark</div>
                            <div className="whitespace-pre-wrap">{t.remark}</div>
                          </div>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1 opacity-60 group-hover:opacity-100 transition-opacity" aria-label="Task actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => toggleM.mutate({ id: t.id, done: t.status !== "done" })}>
                            {t.status === "done" ? "Mark as not done" : "Mark as done"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setRemarkFor(t)}>
                            <MessageSquarePlus className="h-4 w-4" />
                            {t.remark ? "Edit remark" : "Add remark"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => setConfirmDelete(t)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}


      <RemarkDialog
        task={remarkFor}
        onClose={() => setRemarkFor(null)}
        onSave={(remark) => {
          if (!remarkFor) return;
          remarkM.mutate(
            { id: remarkFor.id, remark },
            { onSuccess: () => setRemarkFor(null) },
          );
        }}
        saving={remarkM.isPending}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.title
                ? `"${confirmDelete.title}" will be permanently removed.`
                : "This task will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDelete) return;
                deleteM.mutate({ id: confirmDelete.id }, {
                  onSuccess: () => setConfirmDelete(null),
                });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RemarkDialog({
  task,
  onClose,
  onSave,
  saving,
}: {
  task: Task | null;
  onClose: () => void;
  onSave: (remark: string) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState("");
  const open = !!task;
  useEffect(() => {
    if (task) setValue(task.remark ?? "");
    else setValue("");
  }, [task]);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) { setValue(""); onClose(); }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task?.remark ? "Edit remark" : "Add remark"}</DialogTitle>
          <DialogDescription>
            Explain progress, blockers, or why this task is still pending. The
            person who created it will see this note.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Blocked on vendor reply — expecting answer Monday."
          rows={5}
          maxLength={1000}
        />
        <div className="text-[11px] text-muted-foreground text-right">
          {value.length} / 1000
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {task?.remark && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSave("")}
              disabled={saving}
              className="mr-auto text-destructive hover:text-destructive"
            >
              Clear
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => { setValue(""); onClose(); }} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave(value)} disabled={saving || value.trim().length === 0}>
            {saving ? "Saving…" : "Save remark"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDay(d: string, today: string) {
  if (d === today) return "Today";
  const a = new Date(today + "T00:00:00");
  const b = new Date(d + "T00:00:00");
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Due • Yesterday";
  if (diff < 0) return `Due • ${Math.abs(diff)} days ago`;
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" });
}
