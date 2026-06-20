import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { myTasksFn, toggleTaskFn } from "@/lib/zt.functions";
import { PageHeader, ErrorBox, EmptyState } from "./_app.index";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/my/tasks")({
  component: MyTasks,
  head: () => ({ meta: [{ title: "My tasks — ZeroSync" }] }),
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
  (q.data ?? []).forEach((t: any) => { (groups[t.due_date] = groups[t.due_date] || []).push(t); });
  const days = Object.keys(groups).sort();

  return (
    <div className="space-y-6">
      <PageHeader title="My tasks" subtitle="Your assignments for the next 14 days." />
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : days.length === 0 ? (
        <EmptyState message="No tasks assigned." />
      ) : (
        <div className="space-y-3">
          {days.map((d) => {
            const open = groups[d].filter((t) => t.status !== "done").length;
            return (
              <Card key={d}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">{formatDay(d, today)}</CardTitle>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{d}</div>
                  </div>
                  <Badge variant={open === 0 ? "secondary" : "default"}>
                    {open === 0 ? "All done" : `${open} open`}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="divide-y divide-border -mx-2">
                    {groups[d].map((t) => (
                      <li key={t.id} className="px-2 py-2.5 flex items-start gap-3">
                        <Checkbox
                          checked={t.status === "done"}
                          onCheckedChange={(c) => m.mutate({ id: t.id, done: !!c })}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={"text-sm " + (t.status === "done" ? "line-through text-muted-foreground" : "font-medium")}>
                            {t.title}
                          </div>
                          {t.details && <div className="text-xs text-muted-foreground mt-0.5">{t.details}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
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
