import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { myTasksFn, toggleTaskFn } from "@/lib/zt.functions";
import { PageHeader, ErrorBox, EmptyState } from "./_app.index";

export const Route = createFileRoute("/_app/my/tasks")({
  component: MyTasks,
  head: () => ({ meta: [{ title: "My tasks — ZeroTrack" }] }),
});

function MyTasks() {
  const list = useServerFn(myTasksFn);
  const toggle = useServerFn(toggleTaskFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-tasks"], queryFn: () => list() });
  const m = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const groups: Record<string, any[]> = {};
  (q.data ?? []).forEach((t: any) => {
    (groups[t.due_date] = groups[t.due_date] || []).push(t);
  });
  const days = Object.keys(groups).sort();

  return (
    <div>
      <PageHeader title="My tasks" subtitle="Your assignments for the next 14 days." />
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : days.length === 0 ? (
        <EmptyState message="No tasks assigned." />
      ) : (
        <div className="space-y-4">
          {days.map((d) => (
            <div key={d} className="border border-border">
              <div className="bg-muted px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground flex justify-between">
                <span>{formatDay(d, today)}</span>
                <span className="font-mono">{d}</span>
              </div>
              <ul>
                {groups[d].map((t) => (
                  <li key={t.id} className="border-t border-border px-3 py-2 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={t.status === "done"}
                      onChange={(e) => m.mutate({ id: t.id, done: e.target.checked })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className={t.status === "done" ? "line-through text-muted-foreground" : ""}>
                        {t.title}
                      </div>
                      {t.details && <div className="text-xs text-muted-foreground mt-0.5">{t.details}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDay(d: string, today: string) {
  if (d === today) return "Today";
  const a = new Date(today + "T00:00:00");
  const b = new Date(d + "T00:00:00");
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" });
}

function _unused(v: number) { return v; }
