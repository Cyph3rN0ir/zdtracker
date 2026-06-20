import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createTaskFn, deleteTaskFn, listBusinessTasksFn, listMembersFn, toggleTaskFn } from "@/lib/zt.functions";

export const Route = createFileRoute("/_app/businesses/$id/tasks")({
  component: Tasks,
});

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 sun
  const diff = (day === 0 ? -6 : 1) - day; // make Monday start
  x.setDate(x.getDate() + diff);
  return x;
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

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
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return toISO(d);
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
          businessId: id,
          assigneeUserId: adding!.userId,
          title: form.title.trim(),
          details: form.details,
          dueDate: adding!.date,
        },
      }),
    onSuccess: () => {
      setAdding(null);
      setForm({ title: "", details: "" });
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
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + n * 7);
    setWeekStart(toISO(d));
  }

  const canAssign = me.role === "admin" || me.role === "owner";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={() => shiftWeek(-1)} className="border border-border px-2 py-1 text-xs">‹ Prev</button>
          <button onClick={() => setWeekStart(toISO(startOfWeek()))} className="border border-border px-2 py-1 text-xs">
            This week
          </button>
          <button onClick={() => shiftWeek(1)} className="border border-border px-2 py-1 text-xs">Next ›</button>
        </div>
        <div className="text-xs text-muted-foreground">
          Week of <span className="font-mono">{weekStart}</span>
        </div>
      </div>

      <div className="border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="px-2 py-2 text-left font-medium w-40">Assignee</th>
              {days.map((d) => (
                <th key={d} className="px-2 py-2 text-left font-medium">
                  <div>{new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}</div>
                  <div className="font-mono text-muted-foreground">{d.slice(5)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(members.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Add people to this business first.
                </td>
              </tr>
            ) : (
              (members.data ?? []).map((mem: any) => (
                <tr key={mem.id} className="border-t border-border align-top">
                  <td className="px-2 py-2">
                    <div className="font-medium">{mem.user?.username}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{mem.role_in_business}</div>
                  </td>
                  {days.map((d) => (
                    <td key={d} className="px-2 py-2 border-l border-border min-w-[120px]">
                      <ul className="space-y-1">
                        {(grid[mem.user_id]?.[d] ?? []).map((t) => (
                          <li key={t.id} className="flex items-start gap-1">
                            <input
                              type="checkbox"
                              checked={t.status === "done"}
                              onChange={(e) => tg.mutate({ id: t.id, done: e.target.checked })}
                              className="mt-0.5"
                            />
                            <span className={"flex-1 " + (t.status === "done" ? "line-through text-muted-foreground" : "")}>
                              {t.title}
                            </span>
                            {canAssign && (
                              <button
                                onClick={() => dm.mutate(t.id)}
                                className="text-[10px] text-destructive opacity-0 group-hover:opacity-100"
                                title="Delete"
                              >
                                ×
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {canAssign && (
                        <button
                          onClick={() => {
                            setAdding({ userId: mem.user_id, date: d });
                            setForm({ title: "", details: "" });
                          }}
                          className="mt-1 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          + add
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setAdding(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (form.title.trim()) addM.mutate();
            }}
            className="bg-background border border-border p-5 w-full max-w-md"
          >
            <h3 className="font-semibold mb-1">New task</h3>
            <div className="text-xs text-muted-foreground mb-4 font-mono">{adding.date}</div>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title"
              className="w-full border border-input px-3 py-2 text-sm mb-2"
              required
            />
            <textarea
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="Details (optional)"
              rows={3}
              className="w-full border border-input px-3 py-2 text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(null)} className="px-3 py-1.5 text-sm border border-border">
                Cancel
              </button>
              <button className="bg-primary text-primary-foreground px-3 py-1.5 text-sm" disabled={addM.isPending}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
