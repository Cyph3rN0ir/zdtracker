import { lazy, Suspense, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// Recharts is ~100KB gz — load it on demand so other routes don't pay for it.
const DonutChart = lazy(() => import("./OverviewCharts").then((m) => ({ default: m.DonutChart })));
const IncomeExpenseBars = lazy(() => import("./OverviewCharts").then((m) => ({ default: m.IncomeExpenseBars })));
const NetWorthLine = lazy(() => import("./OverviewCharts").then((m) => ({ default: m.NetWorthLine })));

function ChartFallback() {
  return <div className="h-full w-full animate-pulse rounded-md bg-muted/40" />;
}
import {
  computeBudgetStatus,
  fmtMoney,
  isIncome,
  isSpend,
  TX_KIND_LABEL,
  TxRow,
  BudgetRow,
  periodWindow,
  txDirection,
  toLocalISO,
} from "@/lib/personal-finance";

type Cat = { id: string; name: string; color: string; kind: "income" | "expense" };
type Account = { id: string; name: string; type: string; opening_balance: number | string };

export function PersonalOverview({
  tx, budgets, categories, accounts, currency,
}: {
  tx: TxRow[]; budgets: BudgetRow[]; categories: Cat[]; accounts: Account[]; currency: string;
}) {
  const week = periodWindow("week");
  const month = periodWindow("month");

  const weekSpend = tx.filter((t) => isSpend(t.kind) && t.occurred_on >= week.start && t.occurred_on <= week.end)
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthSpend = tx.filter((t) => isSpend(t.kind) && t.occurred_on >= month.start && t.occurred_on <= month.end)
    .reduce((s, t) => s + Number(t.amount), 0);

  // Savings: opening balance of savings-typed accounts + net effect of
  // savings-kinded transactions on those accounts. Uses the same rule as
  // accountBalances so the two never drift apart.
  const savingsAcctIds = new Set(accounts.filter((a) => a.type === "savings").map((a) => a.id));
  const savingsBase = accounts
    .filter((a) => savingsAcctIds.has(a.id))
    .reduce((s, a) => s + Number(a.opening_balance || 0), 0);
  const savingsDelta = tx.reduce((s, t) => {
    const amt = Number(t.amount);
    const onSav = t.account_id && savingsAcctIds.has(t.account_id);
    const toSav = t.transfer_account_id && savingsAcctIds.has(t.transfer_account_id);
    if (t.kind === "savings_deposit" && onSav) return s + amt;
    if (t.kind === "savings_withdraw" && onSav) return s - amt;
    if (t.kind === "transfer") {
      if (onSav) s -= amt;
      if (toSav) s += amt;
      return s;
    }
    return s;
  }, 0);
  const savingsBalance = savingsBase + savingsDelta;
  const savedThisMonth = tx
    .filter((t) => t.occurred_on >= month.start && t.occurred_on <= month.end)
    .reduce((s, t) => {
      const amt = Number(t.amount);
      const onSav = t.account_id && savingsAcctIds.has(t.account_id);
      const toSav = t.transfer_account_id && savingsAcctIds.has(t.transfer_account_id);
      if (t.kind === "savings_deposit" && onSav) return s + amt;
      if (t.kind === "savings_withdraw" && onSav) return s - amt;
      if (t.kind === "transfer" && toSav) return s + amt;
      if (t.kind === "transfer" && onSav) return s - amt;
      return s;
    }, 0);

  const netWorth = useMemo(() => {
    const acctBase = accounts.reduce((s, a) => s + Number(a.opening_balance || 0), 0);
    const delta = tx.reduce((s, t) => {
      const d = txDirection(t.kind);
      return s + (d === "in" ? Number(t.amount) : d === "out" ? -Number(t.amount) : 0);
    }, 0);
    return acctBase + delta;
  }, [accounts, tx]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const byCat = new Map<string, number>();
  for (const t of tx) {
    if (!isSpend(t.kind)) continue;
    if (t.occurred_on < month.start || t.occurred_on > month.end) continue;
    const key = t.category_id ?? "uncategorized";
    byCat.set(key, (byCat.get(key) ?? 0) + Number(t.amount));
  }
  const donut = Array.from(byCat.entries())
    .map(([id, value]) => {
      const c = catMap.get(id);
      return { id, name: c?.name ?? "Uncategorized", color: c?.color ?? "#64748b", value };
    })
    .sort((a, b) => b.value - a.value);

  const daily = useMemo(() => {
    const days: { date: string; income: number; expense: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ date: toLocalISO(d), income: 0, expense: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.date, i]));
    for (const t of tx) {
      const i = idx.get(t.occurred_on);
      if (i == null) continue;
      if (isIncome(t.kind)) days[i].income += Number(t.amount);
      else if (isSpend(t.kind)) days[i].expense += Number(t.amount);
    }
    return days.map((d) => ({ ...d, label: d.date.slice(5) }));
  }, [tx]);

  // Per-account current balance (opening + signed deltas).
  // - transfer: debit account_id, credit transfer_account_id.
  // - savings_deposit / investment_buy: account_id IS the savings/investment
  //   account being credited (the cash debit isn't tracked separately in this
  //   single-account model). Without this special-case, txDirection ("out")
  //   would debit the savings account, so its balance would never grow.
  // - savings_withdraw / investment_sell: debit account_id (the savings/inv
  //   account); the cash credit isn't tracked separately.
  // - all other kinds: follow txDirection on account_id.
  const accountBalances = useMemo(() => {
    const base = new Map<string, number>();
    for (const a of accounts) base.set(a.id, Number(a.opening_balance || 0));
    const credit = (id: string | null, n: number) => { if (id) base.set(id, (base.get(id) ?? 0) + n); };
    for (const t of tx) {
      const amt = Number(t.amount);
      if (t.kind === "transfer") {
        credit(t.account_id, -amt);
        credit(t.transfer_account_id, +amt);
      } else if (t.kind === "savings_deposit" || t.kind === "investment_buy") {
        credit(t.account_id, +amt);
      } else if (t.kind === "savings_withdraw" || t.kind === "investment_sell") {
        credit(t.account_id, -amt);
      } else {
        const d = txDirection(t.kind);
        credit(t.account_id, d === "in" ? +amt : d === "out" ? -amt : 0);
      }
    }
    return accounts.map((a) => ({ ...a, balance: base.get(a.id) ?? 0 }));
  }, [accounts, tx]);

  // 30-day net-worth line (running sum of signed flows, starting from netWorth − totalDelta).
  const netWorthSeries = useMemo(() => {
    const todayDate = new Date();
    const startISO = (() => { const d = new Date(todayDate); d.setDate(d.getDate() - 29); return toLocalISO(d); })();
    // Net worth as of the day before the window starts.
    let running = netWorth - tx
      .filter((t) => t.occurred_on >= startISO)
      .reduce((s, t) => {
        const d = txDirection(t.kind);
        return s + (d === "in" ? Number(t.amount) : d === "out" ? -Number(t.amount) : 0);
      }, 0);
    const points: { date: string; label: string; value: number }[] = [];
    const dayDelta = new Map<string, number>();
    for (const t of tx) {
      if (t.occurred_on < startISO) continue;
      const d = txDirection(t.kind);
      const flow = d === "in" ? Number(t.amount) : d === "out" ? -Number(t.amount) : 0;
      dayDelta.set(t.occurred_on, (dayDelta.get(t.occurred_on) ?? 0) + flow);
    }
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayDate); d.setDate(d.getDate() - i);
      const iso = toLocalISO(d);
      running += dayDelta.get(iso) ?? 0;
      points.push({ date: iso, label: iso.slice(5), value: Math.round(running * 100) / 100 });
    }
    return points;
  }, [tx, netWorth]);

  const weeklyBudgets = budgets.filter((b) => b.active && b.period === "week");
  const monthlyBudgets = budgets.filter((b) => b.active && b.period === "month");

  return (
    <div className="space-y-6 min-w-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
        <StatCard label="Net worth" value={fmtMoney(netWorth, currency)} />
        <StatCard label="This week spend" value={fmtMoney(weekSpend, currency)} />
        <StatCard label="This month spend" value={fmtMoney(monthSpend, currency)} />
        <StatCard
          label="Savings"
          value={fmtMoney(savingsBalance, currency)}
          hint={`${savedThisMonth >= 0 ? "+" : "−"}${fmtMoney(Math.abs(savedThisMonth), currency)} this month`}
        />
      </div>

      {(weeklyBudgets.length + monthlyBudgets.length) > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          {weeklyBudgets.map((b) => <BudgetCard key={b.id} budget={b} tx={tx} currency={currency} />)}
          {monthlyBudgets.map((b) => <BudgetCard key={b.id} budget={b} tx={tx} currency={currency} />)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spend by category</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            {donut.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">No expenses yet this month.</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {donut.map((d) => <Cell key={d.id} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtMoney(v, currency)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
              {donut.slice(0, 8).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="font-mono">{fmtMoney(d.value, currency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last 30 days</CardTitle>
            <CardDescription>Income vs expense</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" fontSize={10} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={10} stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(v: number) => fmtMoney(v, currency)} />
                  <Bar dataKey="income" fill="#16a34a" />
                  <Bar dataKey="expense" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Net worth — 30 days</CardTitle>
            <CardDescription>Running balance across all accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={netWorthSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" fontSize={10} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={10} stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(v: number) => fmtMoney(v, currency)} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account balances</CardTitle>
            <CardDescription>Opening + activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {accountBalances.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No accounts yet.</div>}
              {accountBalances.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{a.type}</Badge>
                    <span className="truncate">{a.name}</span>
                  </div>
                  <Money className={`text-xs sm:text-sm text-right max-w-[55%] ${a.balance < 0 ? "text-rose-500" : ""}`}>
                    {fmtMoney(a.balance, currency)}
                  </Money>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {tx.slice(0, 8).map((t) => {
              const dir = txDirection(t.kind);
              const sign = dir === "in" ? "+" : dir === "out" ? "−" : "";
              const color = dir === "in" ? "text-emerald-500" : dir === "out" ? "text-rose-500" : "text-muted-foreground";
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{TX_KIND_LABEL[t.kind]}</Badge>
                    <span className="truncate text-muted-foreground">{t.note || catMap.get(t.category_id ?? "")?.name || "—"}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 max-w-[55%] sm:flex-row sm:items-center sm:gap-3">
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">{t.occurred_on}</span>
                    <Money className={`text-xs sm:text-sm text-right ${color}`}>{sign}{fmtMoney(t.amount, currency)}</Money>
                  </div>
                </div>
              );
            })}
            {tx.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Render arbitrary-length localized money strings (e.g. Bangla "১,২৩৪,৫৬৭.৮৯ টাকা")
// without overflowing parent flex/grid cells. Use everywhere a money value
// appears so future overflow regressions don't reappear.
function Money({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono tabular-nums [overflow-wrap:anywhere] ${className}`}
    >
      {children}
    </span>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-1.5 min-w-0">
        <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <Money className="block text-sm sm:text-base lg:text-lg font-semibold leading-tight">
          {value}
        </Money>
        {hint && (
          <Money className="block text-[10px] mt-0.5 text-muted-foreground">
            {hint}
          </Money>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetCard({ budget, tx, currency }: { budget: BudgetRow; tx: TxRow[]; currency: string }) {
  const s = computeBudgetStatus(budget, tx);
  const tone =
    s.pct >= 100 ? "text-rose-500" : s.pct >= 75 ? "text-amber-500" : "text-emerald-500";
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-2 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <CardTitle className="text-base truncate min-w-0">{budget.name}</CardTitle>
          <Badge variant="secondary" className="capitalize shrink-0">{budget.period}</Badge>
        </div>
        <CardDescription className="min-w-0 [overflow-wrap:anywhere]">
          {s.daysLeft} day{s.daysLeft === 1 ? "" : "s"} left · projected {fmtMoney(s.projected, currency)}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 min-w-0">
          <Money className={`text-lg sm:text-2xl font-semibold min-w-0 ${tone}`}>
            {fmtMoney(Math.max(0, s.remaining), currency)}
          </Money>
          <Money className="text-[10px] sm:text-xs text-muted-foreground text-right min-w-0">
            {fmtMoney(s.spent, currency)} / {fmtMoney(s.limit, currency)}
          </Money>
        </div>
        <Progress value={s.pct} className="mt-2 h-2" />
        <div className="mt-1 text-xs text-muted-foreground">remaining of {budget.period}ly budget</div>
      </CardContent>
    </Card>
  );
}
