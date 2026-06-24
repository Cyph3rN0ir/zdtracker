import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listTodosFn } from "@/lib/notebook.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { TodoRow, type Todo } from "@/components/notebook/TodoRow";
import { QuickAdd } from "@/components/notebook/QuickAdd";

export const Route = createFileRoute("/_app/notebook/today")({
  component: TodayPage,
  validateSearch: (s: Record<string, unknown>) => ({
    date: typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : undefined,
  }),
  head: () => ({ meta: [{ title: "Today — Notebook — ZeroSync" }] }),
});

function localToday(): string {
  // YYYY-MM-DD in the user's local timezone
  return new Date().toLocaleDateString("en-CA");
}

function shiftDate(d: string, days: number): string {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + days);
  return dt.toLocaleDateString("en-CA");
}

function TodayPage() {
  const search = Route.useSearch();
  const nav = useNavigate({ from: "/notebook/today" });
  const today = localToday();
  const date = search.date ?? today;

  const list = useServerFn(listTodosFn);
  const q = useQuery({
    queryKey: ["notebook", "today", date],
    queryFn: () =>
      list({
        data: {
          from: date,
          to: date,
          includeOverdue: date === today,
          includeUnscheduled: true,
        },
      }),
  });

  const invalidateKeys = [["notebook", "today", date]];
  const goto = (d: string) => nav({ search: d === today ? {} : { date: d }, replace: true });

  const { overdue, todays, someday } = useMemo(() => {
    const rows: Todo[] = (q.data ?? []) as Todo[];
    const overdue = rows.filter((t) => t.due_date && t.due_date < date && !t.done_at);
    const todays = rows.filter((t) => t.due_date === date);
    const someday = rows.filter((t) => !t.due_date);
    return { overdue, todays, someday };
  }, [q.data, date]);

  const doneCount = todays.filter((t) => !!t.done_at).length;
  const totalCount = todays.length;
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const headerLabel = useMemo(() => {
    if (date === today) return "Today";
    if (date === shiftDate(today, 1)) return "Tomorrow";
    if (date === shiftDate(today, -1)) return "Yesterday";
    return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, [date, today]);

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Date header */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 rounded-xl border border-border bg-card px-2 py-2">
        <button
          aria-label="Previous day"
          onClick={() => goto(shiftDate(date, -1))}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md hover:bg-accent active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col items-center px-1">
          <div className="w-full text-center text-sm font-semibold truncate">{headerLabel}</div>
          <div className="text-[11px] font-mono text-muted-foreground">{date}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {date !== today && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => goto(today)}
              className="h-9 px-2 sm:px-3"
            >
              <CalendarDays className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Today</span>
            </Button>
          )}
          <button
            aria-label="Next day"
            onClick={() => goto(shiftDate(date, 1))}
            className="grid h-10 w-10 place-items-center rounded-md hover:bg-accent active:scale-95"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <span className="text-foreground font-semibold">{doneCount}</span> / {totalCount} done
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-3">
          {date === today && overdue.length > 0 && (
            <Section title={`Overdue (${overdue.length})`} variant="destructive">
              {overdue.map((t) => (
                <TodoRow key={t.id} t={t} invalidateKeys={invalidateKeys} />
              ))}
            </Section>
          )}
          <Section title={headerLabel + (totalCount ? ` (${totalCount})` : "")}>
            {todays.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                Nothing scheduled. Add one below.
              </div>
            ) : (
              todays.map((t) => <TodoRow key={t.id} t={t} invalidateKeys={invalidateKeys} />)
            )}
          </Section>
          {someday.length > 0 && (
            <Section title={`Someday (${someday.length})`}>
              {someday.map((t) => (
                <TodoRow key={t.id} t={t} invalidateKeys={invalidateKeys} />
              ))}
            </Section>
          )}
        </div>
      )}

      <QuickAdd
        dueDate={date}
        invalidateKeys={invalidateKeys}
        placeholder={`Add a task for ${headerLabel.toLowerCase()}…`}
      />
    </div>
  );
}

function Section({
  title,
  children,
  variant,
}: {
  title: string;
  children: React.ReactNode;
  variant?: "destructive";
}) {
  return (
    <Card className={variant === "destructive" ? "border-destructive/40" : ""}>
      <div className={"px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide " + (variant === "destructive" ? "text-destructive" : "text-muted-foreground")}>
        {title}
      </div>
      <ul className="divide-y divide-border px-2 pb-2">{children}</ul>
    </Card>
  );
}
