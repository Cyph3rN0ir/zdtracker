import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createTaskFn, deleteTaskFn, listBusinessTasksFn, listMembersFn, toggleTaskFn } from "@/lib/zt.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, CheckCircle2, Circle, UserPlus } from "lucide-react";
import { useI18n, roleLabel, type Lang } from "@/lib/i18n";

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
function fmtDay(iso: string, lang: Lang = "en") {
  const locale = lang === "bn" ? "bn-BD" : undefined;
  return new Date(iso + "T00:00:00").toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" });
}

function Tasks() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext() as any;
  const { t, lang } = useI18n();
  const listT = useServerFn(listBusinessTasksFn);
  const listM = useServerFn(listMembersFn);
  const create = useServerFn(createTaskFn);
  const toggle = useServerFn(toggleTaskFn);
  const del = useServerFn(deleteTaskFn);
  const qc = useQueryClient();

  const [weekStart, setWeekStart] = useState(() => toISO(startOfWeek()));
  const today = toISO(new Date());
  const [activeDay, setActiveDay] = useState(today);

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

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    days.forEach((d) => (map[d] = []));
    (tasks.data ?? []).forEach((t: any) => {
      (map[t.due_date] ||= []).push(t);
    });
    return map;
  }, [tasks.data, days]);

  const userById = useMemo(() => {
    const m: Record<string, any> = {};
    (members.data ?? []).forEach((mem: any) => { m[mem.user_id] = mem; });
    return m;
  }, [members.data]);

  const canAssign = me.role === "admin" || me.role === "owner";
  const canDelete = me.role === "admin";
  const canCreate = !!me.userId; // any signed-in user can create (self-assigned if not admin/owner)

  const [adding, setAdding] = useState<{ date: string } | null>(null);
  const [form, setForm] = useState({ title: "", details: "", assigneeUserId: "" });
  const [formErr, setFormErr] = useState<string | null>(null);

  const addM = useMutation({
    mutationFn: () => create({
      data: {
        businessId: id,
        assigneeUserId: canAssign ? form.assigneeUserId : me.userId,
        title: form.title.trim(),
        details: form.details,
        dueDate: adding!.date,
      },
    }),
    onSuccess: () => {
      toast.success(t("tasks.toast.created"));
      setAdding(null); setForm({ title: "", details: "", assigneeUserId: "" }); setFormErr(null);
      qc.invalidateQueries({ queryKey: ["tasks", id, weekStart] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("tasks.toast.createFailed")),
  });

  const tg = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", id, weekStart] }),
    onError: (e: any) => toast.error(e?.message ?? t("tasks.toast.updateFailed")),
  });
  const dm = useMutation({
    mutationFn: (tid: string) => del({ data: { id: tid } }),
    onSuccess: () => { toast.success(t("tasks.toast.deleted")); qc.invalidateQueries({ queryKey: ["tasks", id, weekStart] }); },
    onError: (e: any) => toast.error(e?.message ?? t("money.toast.deleteFailed")),
  });

  function shiftWeek(n: number) {
    const d = new Date(weekStart + "T00:00:00"); d.setDate(d.getDate() + n * 7); setWeekStart(toISO(d));
  }

  function submitTask(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return setFormErr(t("tasks.err.title"));
    if (form.title.trim().length > 200) return setFormErr(t("tasks.err.titleLong"));
    if (canAssign && !form.assigneeUserId) return setFormErr(t("tasks.err.assignee"));
    setFormErr(null);
    addM.mutate();
  }

  const dayTasks = byDay[activeDay] ?? [];
  const dayDone = dayTasks.filter((t) => t.status === "done").length;

  const noMembers = (members.data ?? []).length === 0;

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)} aria-label={t("tasks.prevWeek")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setWeekStart(toISO(startOfWeek())); setActiveDay(today); }}>
              <CalendarDays className="h-4 w-4" /> {t("tasks.thisWeek")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => shiftWeek(1)} aria-label={t("tasks.nextWeek")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const count = (byDay[d] ?? []).length;
              const doneCount = (byDay[d] ?? []).filter((t) => t.status === "done").length;
              const isActive = d === activeDay;
              const isToday = d === today;
              const locale = lang === "bn" ? "bn-BD" : undefined;
              return (
                <button
                  key={d}
                  onClick={() => setActiveDay(d)}
                  className={
                    "rounded-md border px-1 py-2 text-center transition-colors min-w-0 " +
                    (isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isToday
                        ? "border-primary/50 bg-accent hover:bg-accent/70"
                        : "border-border bg-background hover:bg-accent")
                  }
                >
                  <div className="text-[10px] uppercase tracking-wider opacity-80 truncate">
                    {new Date(d + "T00:00:00").toLocaleDateString(locale, { weekday: "short" })}
                  </div>
                  <div className="font-display text-base font-bold leading-tight">{d.slice(8)}</div>
                  <div className={"mt-1 text-[10px] font-mono " + (isActive ? "opacity-90" : "text-muted-foreground")}>
                    {count > 0 ? `${doneCount}/${count}` : "·"}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day detail */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{fmtDay(activeDay, lang)}</CardTitle>
            <CardDescription className="truncate">
              {dayTasks.length === 0
                ? t("tasks.noneScheduled")
                : t("tasks.summary", { done: dayDone, total: dayTasks.length })}
            </CardDescription>
          </div>
          {canCreate && !noMembers && (
            <Button size="sm" className="shrink-0" onClick={() => { setAdding({ date: activeDay }); setForm({ title: "", details: "", assigneeUserId: "" }); setFormErr(null); }}>
              <Plus className="h-4 w-4" /> {t("tasks.addTask")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {noMembers ? (
            <EmptyCTA
              title={t("tasks.empty.noAssignees.title")}
              message={t("tasks.empty.noAssignees.msg")}
              cta={canAssign ? (
                <Button size="sm" className="mt-4" asChild>
                  <Link to="/businesses/$id/people" params={{ id }}>
                    <UserPlus className="h-4 w-4" /> {t("money.addPeople")}
                  </Link>
                </Button>
              ) : undefined}
            />
          ) : dayTasks.length === 0 ? (
            <EmptyCTA
              title={t("tasks.empty.noTasks.title")}
              message={t("tasks.empty.noTasks.msg")}
              action={canCreate ? { label: t("tasks.empty.addOne"), onClick: () => { setAdding({ date: activeDay }); setForm({ title: "", details: "", assigneeUserId: "" }); setFormErr(null); } } : undefined}
            />
          ) : (
            <ul className="divide-y divide-border">
              {dayTasks.map((task: any) => {
                const u = userById[task.assignee_user_id];
                const isMine = task.assignee_user_id === me.userId;
                const canToggle = isMine; // only the assignee may mark the task done
                const done = task.status === "done";
                return (
                  <li key={task.id} className="flex items-start gap-3 px-4 sm:px-6 py-3">
                    <button
                      onClick={() => canToggle && tg.mutate({ id: task.id, done: !done })}
                      disabled={!canToggle}
                      aria-label={done ? t("tasks.markPending") : t("tasks.markDone")}
                      className="mt-0.5 text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={"text-sm font-medium break-words " + (done ? "line-through text-muted-foreground" : "")}>
                        {task.title}
                      </div>
                      {task.details && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">{task.details}</div>
                      )}
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {u?.user?.username ?? t("common.unknown")}
                        </Badge>
                        {u?.role_in_business && (
                          <span className="text-[10px] tracking-wider text-muted-foreground">
                            {roleLabel(u.role_in_business, t)}
                          </span>
                        )}
                      </div>
                    </div>
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => dm.mutate(task.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Week summary per assignee */}
      {!noMembers && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tasks.weekSummary")}</CardTitle>
            <CardDescription>{t("tasks.weekSummaryDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(members.data ?? []).map((mem: any) => {
              const mine = (tasks.data ?? []).filter((x: any) => x.assignee_user_id === mem.user_id);
              const done = mine.filter((x: any) => x.status === "done").length;
              const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
              return (
                <div key={mem.id} className="flex items-center gap-3 text-sm">
                  <div className="w-32 min-w-0 truncate font-medium">{mem.user?.username}</div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-16 text-right font-mono text-xs text-muted-foreground">
                    {done}/{mine.length}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("tasks.newTask")}</DialogTitle>
            <DialogDescription>{adding ? fmtDay(adding.date, lang) : ""}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTask} className="space-y-3">
            {canAssign ? (
              <div className="space-y-1.5">
                <Label>{t("tasks.assignee")}</Label>
                <Select value={form.assigneeUserId} onValueChange={(v) => setForm({ ...form, assigneeUserId: v })}>
                  <SelectTrigger><SelectValue placeholder={t("tasks.chooseAssignee")} /></SelectTrigger>
                  <SelectContent>
                    {(members.data ?? []).map((m: any) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.user?.username} ({roleLabel(m.role_in_business, t)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("tasks.assignee")}: <span className="font-medium text-foreground">{t("common.you") ?? "You"}</span></p>
            )}
            <div className="space-y-1.5">
              <Label>{t("tasks.title")}</Label>
              <Input autoFocus required maxLength={200} value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("tasks.details")}</Label>
              <Textarea rows={3} maxLength={1000} value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })} />
            </div>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdding(null)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={addM.isPending}>{t("tasks.createTask")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyCTA({
  title, message, action, cta, icon,
}: {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  cta?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto mb-3 h-10 w-10 grid place-items-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <CalendarDays className="h-5 w-5" />}
      </div>
      <div className="font-display text-sm font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{message}</p>
      {action && (
        <Button size="sm" className="mt-4" onClick={action.onClick}>
          <Plus className="h-4 w-4" /> {action.label}
        </Button>
      )}
      {cta}
    </div>
  );
}
