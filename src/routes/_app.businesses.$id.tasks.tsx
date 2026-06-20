import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createTaskFn, deleteTaskFn, listBusinessTasksFn, listMembersFn, toggleTaskFn } from "@/lib/zt.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, X, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_app/businesses/$id/tasks")({
  component: Tasks,
});

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x;
}
function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function Tasks() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext() as any;
  const listT = useServerFn(listBusinessTasksFn);
  const listM = useServerFn(listMembersFn);
  const create = useServerFn(createTaskFn);
  const toggle = useServerFn(toggleTaskFn);
  const del = useServerFn(deleteTaskFn);
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => toISO(startOfWeek()));
  const tasks = useQuery({
    queryKey: ["tasks", id, weekStart],
    queryFn: () => listT({ data: { businessId: id, weekStart } }),
  });
  const members = useQuery({ queryKey: ["members", id], queryFn: () => listM({ data: { businessId: id } }) });

  const days = useMemo(() => {
    const start = new Date(weekStart + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return toISO(d);
    });
  }, [weekStart]);

  const grid = useMemo(() => {
    const m: Record<string, Record<string, any[]>> = {};
    (members.data ?? []).forEach((mem: any) => {
      m[mem.user_id] = {};
      days.forEach((d) => (m[mem.user_id][d] = []));
    });
    (tasks.data ?? []).forEach((t: any) => {
      if (!m[t.assignee_user_id]) m[t.assignee_user_id] = {};
      if (!m[t.assignee_user_id][t.due_date]) m[t.assignee_user_id][t.due_date] = [];
      m[t.assignee_user_id][t.due_date].push(t);
    });
    return m;
  }, [members.data, tasks.data, days]);

  const [adding, setAdding] = useState<{ userId: string; date: string } | null>(null);
  const [form, setForm] = useState({ title: "", details: "" });
  const addM = useMutation({
    mutationFn: () =>
      create({
        data: {
          businessId: id, assigneeUserId: adding!.userId,
          title: form.title.trim(), details: form.details, dueDate: adding!.date,
        },
      }),
    onSuccess: () => {
      setAdding(null); setForm({ title: "", details: "" });
      qc.invalidateQueries({ queryKey: ["tasks", id, weekStart] });
    },
  });
  const tg = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", id, weekStart] }),
  });
  const dm = useMutation({
    mutationFn: (tid: string) => del({ data: { id: tid } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", id, weekStart] }),
  });

  function shiftWeek(n: number) {
    const d = new Date(weekStart + "T00:00:00"); d.setDate(d.getDate() + n * 7); setWeekStart(toISO(d));
  }
  const canAssign = me.role === "admin" || me.role === "owner";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(toISO(startOfWeek()))}>
            <CalendarDays className="h-4 w-4" /> This week
          </Button>
          <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="text-xs text-muted-foreground">Week of <span className="font-mono">{weekStart}</span></div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2.5 text-left font-medium w-44">Assignee</th>
                {days.map((d) => (
                  <th key={d} className={"px-2 py-2.5 text-left font-medium border-l border-border " + (d === today ? "bg-accent" : "")}>
                    <div className="font-display font-semibold">
                      {new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div className="font-mono text-muted-foreground text-[10px]">{d.slice(5)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(members.data ?? []).length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Add people to this business first.</td></tr>
              ) : (members.data ?? []).map((mem: any) => (
                <tr key={mem.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-sm">{mem.user?.username}</div>
                    <Badge variant="secondary" className="mt-0.5 text-[10px] uppercase px-1.5 py-0">{mem.role_in_business}</Badge>
                  </td>
                  {days.map((d) => (
                    <td key={d} className={"px-2 py-2 border-l border-border min-w-[120px] " + (d === today ? "bg-accent/30" : "")}>
                      <ul className="space-y-1.5">
                        {(grid[mem.user_id]?.[d] ?? []).map((t) => (
                          <li key={t.id} className="group rounded-md border border-border bg-background px-2 py-1.5 flex items-start gap-2">
                            <Checkbox
                              checked={t.status === "done"}
                              onCheckedChange={(c) => tg.mutate({ id: t.id, done: !!c })}
                              className="mt-0.5"
                            />
                            <span className={"flex-1 leading-snug " + (t.status === "done" ? "line-through text-muted-foreground" : "")}>
                              {t.title}
                            </span>
                            {canAssign && (
                              <button
                                onClick={() => dm.mutate(t.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                                title="Delete"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {canAssign && (
                        <button
                          onClick={() => { setAdding({ userId: mem.user_id, date: d }); setForm({ title: "", details: "" }); }}
                          className="mt-1.5 w-full flex items-center justify-center gap-1 rounded-md border border-dashed border-border py-1 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Plus className="h-3 w-3" /> add
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription className="font-mono text-xs">{adding?.date}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); if (form.title.trim()) addM.mutate(); }}
            className="space-y-3"
          >
            <Input autoFocus placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Details (optional)" rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdding(null)}>Cancel</Button>
              <Button type="submit" disabled={addM.isPending}>Create task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
