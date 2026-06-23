// Shared helpers + types for the personal-finance UI.
// Pure utility module — safe to import from client and server.

export const TX_KINDS = [
  "income",
  "expense",
  "transfer",
  "investment_buy",
  "investment_sell",
  "savings_deposit",
  "savings_withdraw",
  "loan_given",
  "loan_taken",
  "repayment_in",
  "repayment_out",
] as const;
export type TxKind = (typeof TX_KINDS)[number];

export const TX_KIND_LABEL: Record<TxKind, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  investment_buy: "Investment buy",
  investment_sell: "Investment sell",
  savings_deposit: "Savings deposit",
  savings_withdraw: "Savings withdraw",
  loan_given: "Loan given",
  loan_taken: "Loan taken",
  repayment_in: "Repayment received",
  repayment_out: "Repayment paid",
};

// Sign relative to your net worth (+ flows in, − flows out).
// Transfers, investment moves, and savings moves are net-zero on cash flow
// in the spending sense, so they're excluded from spend/income totals.
export function txDirection(k: TxKind): "in" | "out" | "neutral" {
  switch (k) {
    case "income":
    case "loan_taken":
    case "repayment_in":
    case "investment_sell":
    case "savings_withdraw":
      return "in";
    case "expense":
    case "loan_given":
    case "repayment_out":
    case "investment_buy":
    case "savings_deposit":
      return "out";
    default:
      return "neutral";
  }
}

// Counts toward "spending" budgets: only true expenses.
export function isSpend(k: TxKind) {
  return k === "expense";
}

// Counts toward "income" totals.
export function isIncome(k: TxKind) {
  return k === "income";
}

export function fmtMoney(n: number | string, currency = "INR") {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

// Local-date ISO (YYYY-MM-DD) — uses the user's local timezone, NOT UTC.
// Critical for IST/non-UTC users: toISOString() returns UTC and shifts the
// day across the date boundary, causing wrong "today", wrong period windows,
// and budget math off by a day.
export function toLocalISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toLocalISO(new Date());
}

export function startOfWeekISO(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return toLocalISO(x);
}

export function startOfMonthISO(d = new Date()) {
  return toLocalISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function daysBetween(aIso: string, bIso: string) {
  return Math.round((+new Date(bIso) - +new Date(aIso)) / 86_400_000);
}

export function periodWindow(period: "week" | "month", today = new Date()) {
  if (period === "week") {
    const start = startOfWeekISO(today);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end: toLocalISO(end), totalDays: 7 };
  }
  const start = startOfMonthISO(today);
  const endD = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start, end: toLocalISO(endD), totalDays: endD.getDate() };
}

export interface BudgetRow {
  id: string;
  name: string;
  period: "week" | "month";
  amount: number | string;
  category_id: string | null;
  start_date: string;
  active: boolean;
}

export interface TxRow {
  id: string;
  kind: TxKind;
  amount: number | string;
  note: string;
  occurred_on: string;
  account_id: string | null;
  category_id: string | null;
  counterparty_id: string | null;
  transfer_account_id: string | null;
  linked_loan_id: string | null;
}

export function computeBudgetStatus(b: BudgetRow, tx: TxRow[], today = new Date()) {
  const { start, end, totalDays } = periodWindow(b.period, today);
  const spent = tx
    .filter((t) => isSpend(t.kind))
    .filter((t) => t.occurred_on >= start && t.occurred_on <= end)
    .filter((t) => (b.category_id ? t.category_id === b.category_id : true))
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const limit = Number(b.amount);
  const remaining = limit - spent;
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const elapsedDays = Math.min(totalDays, daysBetween(start, new Date().toISOString().slice(0, 10)) + 1);
  const daysLeft = Math.max(0, totalDays - elapsedDays);
  const projected = elapsedDays > 0 ? (spent / elapsedDays) * totalDays : 0;
  return { start, end, spent, limit, remaining, pct, daysLeft, totalDays, projected };
}
