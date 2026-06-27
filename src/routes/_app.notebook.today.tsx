import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listTodosFn } from "@/lib/notebook.functions";
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
    <div className="space-y-5 pb-4">
      {/* Slim date header */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.14em] tabular-nums text-muted-foreground/70">
            {date}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight truncate">
            {headerLabel}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconBtn aria-label="Previous day" onClick={() => goto(shiftDate(date, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </IconBtn>
          {date !== today && (
            <button
              onClick={() => goto(today)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 h-8 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Today</span>
            </button>
          )}
          <IconBtn aria-label="Next day" onClick={() => goto(shiftDate(date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>

      {/* Thin progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            <span className="text-foreground font-medium tabular-nums">{doneCount}</span>
            <span className="text-muted-foreground/60"> / {totalCount}</span> done
          </span>
          <span className="font-medium tabular-nums">{pct}%</span>
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full bg-foreground transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {q.isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-6">
          {date === today && overdue.length > 0 && (
            <Section title="Overdue" count={overdue.length} accent="destructive">
              {overdue.map((t) => (
                <TodoRow key={t.id} t={t} invalidateKeys={invalidateKeys} />
              ))}
            </Section>
          )}
          <Section title={headerLabel} count={totalCount}>
            {todays.length === 0 ? (
              <div className="px-1 py-6 text-center text-xs text-muted-foreground/80">
                Nothing scheduled. Add one below.
              </div>
            ) : (
              todays.map((t) => (
                <TodoRow key={t.id} t={t} invalidateKeys={invalidateKeys} />
              ))
            )}
          </Section>
          {someday.length > 0 && (
            <Section title="Someday" count={someday.length}>
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

function IconBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="grid h-8 w-8 place-items-center rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-foreground/40 active:scale-95 transition-colors"
    >
      {children}
    </button>
  );
}

function Section({
  title,
  count,
  children,
  accent,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  accent?: "destructive";
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-border/50 pb-1.5 mb-1">
        <h3
          className={
            "text-[11px] font-medium uppercase tracking-[0.14em] " +
            (accent === "destructive" ? "text-destructive" : "text-muted-foreground")
          }
        >
          {title}
        </h3>
        {typeof count === "number" && count > 0 && (
          <span
            className={
              "text-[11px] tabular-nums " +
              (accent === "destructive" ? "text-destructive/80" : "text-muted-foreground/70")
            }
          >
            {count}
          </span>
        )}
      </div>
      <ul className="divide-y divide-border/40">{children}</ul>
    </section>
  );
}
