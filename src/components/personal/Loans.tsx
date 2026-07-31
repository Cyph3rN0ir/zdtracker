import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  upsertPersonalLoanFn, deletePersonalLoanFn, addPersonalTxExFn, settlePersonalLoansFn,
} from "@/lib/zt.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, HandCoins, Pencil, ChevronRight, Users } from "lucide-react";
import { fmtMoney, todayISO, TxRow } from "@/lib/personal-finance";

type Loan = {
  id: string;
  direction: "i_owe" | "owed_to_me";
  counterparty_id: string | null;
  principal: number | string;
  interest_rate: number | string;
  started_on: string;
  due_on: string | null;
  status: "open" | "closed";
  note: string;
};
type Cp = { id: string; name: string };
type Account = { id: string; name: string };

const NONE = "__none__";

export function PersonalLoans({
  profileId, loans, counterparties, accounts, tx, currency,
}: {
  profileId: string;
  loans: Loan[];
  counterparties: Cp[];
  accounts: Account[];
  tx: TxRow[];
  currency: string;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertPersonalLoanFn);
  const del = useServerFn(deletePersonalLoanFn);
  const addTx = useServerFn(addPersonalTxExFn);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["personal-loans", profileId] });
    qc.invalidateQueries({ queryKey: ["personal-tx", profileId] });
    qc.invalidateQueries({ queryKey: ["personal-accts", profileId] });
  };

  const [form, setForm] = useState({
    direction: "i_owe" as "i_owe" | "owed_to_me",
    counterpartyId: "",
    principal: "",
    startedOn: todayISO(),
    dueOn: "",
    note: "",
  });

  const add = useMutation({
    mutationFn: () => upsert({
      data: {
        profileId,
        direction: form.direction,
        counterpartyId: form.counterpartyId || null,
        principal: Number(form.principal),
        interestRate: 0,
        startedOn: form.startedOn,
        dueOn: form.dueOn || null,
        status: "open",
        note: form.note,
      },
    }),
    onSuccess: () => {
      toast.success("Loan added");
      setForm({ ...form, principal: "", dueOn: "", note: "" });
      invalidate();
    },
  });

  const dm = useMutation({
    mutationFn: (id: string) => del({ data: { id, profileId } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
  });

  const closeM = useMutation({
    mutationFn: (l: Loan) => upsert({
      data: {
        id: l.id, profileId, direction: l.direction,
        counterpartyId: l.counterparty_id, principal: Number(l.principal),
        interestRate: Number(l.interest_rate), startedOn: l.started_on,
        dueOn: l.due_on, status: "closed", note: l.note,
      },
    }),
    onSuccess: () => { toast.success("Loan closed"); invalidate(); },
  });

  // Repayment totals per loan from linked transactions.
  const repaidByLoan = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tx) {
      if (!t.linked_loan_id) continue;
      if (t.kind !== "repayment_in" && t.kind !== "repayment_out") continue;
      m.set(t.linked_loan_id, (m.get(t.linked_loan_id) ?? 0) + Number(t.amount));
    }
    return m;
  }, [tx]);

  const cpName = (id: string | null) => counterparties.find((c) => c.id === id)?.name ?? "—";

  const open = loans.filter((l) => l.status === "open");
  const closed = loans.filter((l) => l.status === "closed");

  const totalOwedByMe = open.filter((l) => l.direction === "i_owe")
    .reduce((s, l) => s + Math.max(0, Number(l.principal) - (repaidByLoan.get(l.id) ?? 0)), 0);
  const totalOwedToMe = open.filter((l) => l.direction === "owed_to_me")
    .reduce((s, l) => s + Math.max(0, Number(l.principal) - (repaidByLoan.get(l.id) ?? 0)), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-1.5 px-3 sm:px-6"><CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">I owe (open)</CardTitle></CardHeader>
          <CardContent className="px-3 sm:px-6"><div className="min-w-0 text-base sm:text-lg font-mono tabular-nums font-semibold text-rose-500 break-words leading-tight">{fmtMoney(totalOwedByMe, currency)}</div></CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-1.5 px-3 sm:px-6"><CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">Owed to me (open)</CardTitle></CardHeader>
          <CardContent className="px-3 sm:px-6"><div className="min-w-0 text-base sm:text-lg font-mono tabular-nums font-semibold text-emerald-500 break-words leading-tight">{fmtMoney(totalOwedToMe, currency)}</div></CardContent>
        </Card>
      </div>


      <BalancesByPerson profileId={profileId} loans={loans} counterparties={counterparties} tx={tx} accounts={accounts} currency={currency} onChanged={invalidate} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add loan</CardTitle>
          <CardDescription>Money you borrowed or money you lent.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (Number(form.principal) > 0) add.mutate(); }}
            className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5 md:col-span-1">
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="i_owe">I owe</SelectItem>
                  <SelectItem value="owed_to_me">Owed to me</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label>Person / vendor</Label>
              <Select value={form.counterpartyId || NONE} onValueChange={(v) => setForm({ ...form, counterpartyId: v === NONE ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {counterparties.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label>Principal</Label>
              <Input type="number" step="0.01" min="0" required className="text-right font-mono"
                value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label>Started</Label>
              <Input type="date" value={form.startedOn} onChange={(e) => setForm({ ...form, startedOn: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label>Due (optional)</Label>
              <Input type="date" value={form.dueOn} onChange={(e) => setForm({ ...form, dueOn: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-4">
              <Label>Note</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <Button type="submit" disabled={add.isPending} className="md:col-span-1"><Plus className="h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      {[
        { title: "I owe", items: open.filter((l) => l.direction === "i_owe"), dir: "i_owe" as const },
        { title: "Owed to me", items: open.filter((l) => l.direction === "owed_to_me"), dir: "owed_to_me" as const },
      ].map((group) => (
        <Card key={group.title}>
          <CardHeader><CardTitle className="text-base">{group.title}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {group.items.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Nothing here.</div>}
              {group.items.map((l) => {
                const repaid = repaidByLoan.get(l.id) ?? 0;
                const outstanding = Math.max(0, Number(l.principal) - repaid);
                return (
                  <div key={l.id} className="px-3 sm:px-4 py-3 flex flex-col gap-2 text-sm sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center">
                    <div className="sm:col-span-3 min-w-0">
                      <div className="font-medium truncate">{cpName(l.counterparty_id)}</div>
                      <div className="text-xs text-muted-foreground">{l.started_on}{l.due_on ? ` → ${l.due_on}` : ""}</div>
                      {l.note ? (
                        <div className="text-xs text-muted-foreground mt-0.5 italic break-words">{l.note}</div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:contents">
                      <div className="sm:col-span-2 text-xs text-muted-foreground">Principal<br /><span className="font-mono tabular-nums text-foreground">{fmtMoney(l.principal, currency)}</span></div>
                      <div className="sm:col-span-2 text-xs text-muted-foreground">Repaid<br /><span className="font-mono tabular-nums text-foreground">{fmtMoney(repaid, currency)}</span></div>
                      <div className="sm:col-span-2 text-xs text-muted-foreground">Outstanding<br /><span className={`font-mono tabular-nums ${outstanding > 0 ? "text-foreground" : "text-emerald-500"}`}>{fmtMoney(outstanding, currency)}</span></div>
                    </div>
                    <div className="flex justify-end gap-1.5 sm:col-span-3 flex-wrap">
                      <RepaymentDialog loan={l} accounts={accounts} currency={currency}
                        onAdd={async (amount, accountId, note, occurredOn) => {
                          await addTx({
                            data: {
                              profileId,
                              kind: l.direction === "i_owe" ? "repayment_out" : "repayment_in",
                              amount, note: note || `Repayment for loan`,
                              occurredOn,
                              accountId: accountId || null,
                              categoryId: null,
                              counterpartyId: l.counterparty_id,
                              transferAccountId: null,
                              linkedLoanId: l.id,
                            },
                          });
                          toast.success("Repayment recorded");
                          invalidate();
                        }}
                      />
                      <EditLoanDialog loan={l} counterparties={counterparties} profileId={profileId} onSaved={invalidate} />
                      <Button variant="ghost" size="sm" onClick={() => closeM.mutate(l)}>Close</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {closed.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Closed</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {closed.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{l.direction === "i_owe" ? "I owed" : "Was owed"}</Badge>
                    <span>{cpName(l.counterparty_id)}</span>
                  </div>
                  <span className="font-mono tabular-nums">{fmtMoney(l.principal, currency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RepaymentDialog({
  loan, accounts, currency, onAdd,
}: {
  loan: Loan; accounts: Account[]; currency: string;
  onAdd: (amount: number, accountId: string, note: string, occurredOn: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary"><HandCoins className="h-3.5 w-3.5" /> Repayment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record repayment</DialogTitle>
          <DialogDescription>Repayment for {fmtMoney(loan.principal, currency)} loan.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" step="0.01" min="0" className="text-right font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Account</Label>
            <Select value={accountId || NONE} onValueChange={(v) => setAccountId(v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy || !(Number(amount) > 0)} onClick={async () => {
            setBusy(true);
            try { await onAdd(Number(amount), accountId, note, occurredOn); setOpen(false); setAmount(""); setNote(""); }
            finally { setBusy(false); }
          }}>Save</Button>
        </DialogFooter>
        <div className="text-xs text-muted-foreground">
          Records a <code>{loan.direction === "i_owe" ? "repayment_out" : "repayment_in"}</code> transaction linked to this loan ({fmtMoney(loan.principal, currency)}).
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditLoanDialog({
  loan, counterparties, profileId, onSaved,
}: {
  loan: Loan; counterparties: Cp[]; profileId: string; onSaved: () => void;
}) {
  const upsert = useServerFn(upsertPersonalLoanFn);
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"i_owe" | "owed_to_me">(loan.direction);
  const [counterpartyId, setCounterpartyId] = useState(loan.counterparty_id ?? "");
  const [principal, setPrincipal] = useState(String(loan.principal));
  const [startedOn, setStartedOn] = useState(loan.started_on);
  const [dueOn, setDueOn] = useState(loan.due_on ?? "");
  const [note, setNote] = useState(loan.note ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!(Number(principal) >= 0)) return;
    setBusy(true);
    try {
      await upsert({
        data: {
          id: loan.id, profileId, direction,
          counterpartyId: counterpartyId || null,
          principal: Number(principal),
          interestRate: Number(loan.interest_rate) || 0,
          startedOn, dueOn: dueOn || null,
          status: loan.status, note,
        },
      });
      toast.success("Loan updated");
      onSaved();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit loan</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="i_owe">I owe</SelectItem>
                <SelectItem value="owed_to_me">Owed to me</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Person / vendor</Label>
            <Select value={counterpartyId || NONE} onValueChange={(v) => setCounterpartyId(v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {counterparties.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Principal</Label>
            <Input type="number" step="0.01" min="0" className="text-right font-mono" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Started</Label>
            <Input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Due (optional)</Label>
            <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PerCp = {
  id: string;
  name: string;
  lentToMe: number;
  repaidByMe: number;
  lentByMe: number;
  repaidToMe: number;
  iOweNet: number;
  owedToMeNet: number;
  net: number; // + they owe you, - you owe
  loans: Loan[];
};

function BalancesByPerson({
  profileId, loans, counterparties, tx, accounts, currency, onChanged,
}: {
  profileId: string; loans: Loan[]; counterparties: Cp[]; tx: TxRow[];
  accounts: Account[]; currency: string; onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const rows: PerCp[] = useMemo(() => {
    const cpById = new Map(counterparties.map((c) => [c.id, c.name]));
    const loanCp = new Map<string, string>();
    const groups = new Map<string, PerCp>();
    const key = (id: string | null) => id ?? "__unassigned__";
    const nameOf = (id: string | null) =>
      id ? (cpById.get(id) ?? "—") : "(Unassigned)";

    const ensure = (id: string | null): PerCp => {
      const k = key(id);
      let g = groups.get(k);
      if (!g) {
        g = {
          id: k, name: nameOf(id),
          lentToMe: 0, repaidByMe: 0, lentByMe: 0, repaidToMe: 0,
          iOweNet: 0, owedToMeNet: 0, net: 0, loans: [],
        };
        groups.set(k, g);
      }
      return g;
    };

    for (const l of loans) {
      const g = ensure(l.counterparty_id);
      loanCp.set(l.id, g.id);
      g.loans.push(l);
      const p = Number(l.principal) || 0;
      if (l.direction === "i_owe") g.lentToMe += p;
      else g.lentByMe += p;
    }

    for (const t of tx) {
      if (!t.linked_loan_id) continue;
      const k = loanCp.get(t.linked_loan_id);
      if (!k) continue;
      const g = groups.get(k)!;
      const amt = Number(t.amount) || 0;
      if (t.kind === "repayment_out") g.repaidByMe += amt;
      else if (t.kind === "repayment_in") g.repaidToMe += amt;
    }

    const out = Array.from(groups.values()).map((g) => {
      g.iOweNet = Math.max(0, g.lentToMe - g.repaidByMe);
      g.owedToMeNet = Math.max(0, g.lentByMe - g.repaidToMe);
      g.net = g.owedToMeNet - g.iOweNet;
      return g;
    });
    out.sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));
    return out;
  }, [loans, counterparties, tx]);

  const active = openId ? rows.find((r) => r.id === openId) ?? null : null;

  const summary = useMemo(() => {
    let theyOweCount = 0, youOweCount = 0;
    for (const r of rows) {
      if (r.net > 0) theyOweCount++;
      else if (r.net < 0) youOweCount++;
    }
    return { theyOweCount, youOweCount, total: rows.length };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 shrink-0" /> Balances by person</CardTitle>
            <CardDescription className="mt-0.5">Net amount summed across all loans &amp; repayments.</CardDescription>
          </div>
          {summary.total > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              {summary.theyOweCount > 0 && <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">{summary.theyOweCount} owe you</Badge>}
              {summary.youOweCount > 0 && <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400">{summary.youOweCount} you owe</Badge>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {rows.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No counterparties yet.</div>
          )}
          {rows.map((r) => {
            const settled = r.net === 0;
            const theyOwe = r.net > 0;
            const label = settled ? "Settled" : theyOwe ? "They owe you" : "You owe";
            const dotColor = settled ? "bg-muted-foreground/40" : theyOwe ? "bg-emerald-500" : "bg-rose-500";
            const amtColor = settled ? "text-muted-foreground" : theyOwe ? "text-emerald-500" : "text-rose-500";
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenId(r.id)}
                className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-muted/50 active:bg-muted/70 transition-colors min-h-[56px] focus-visible:outline-none focus-visible:bg-muted/60"
              >
                <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate text-sm sm:text-[15px]">{r.name}</div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground">{label}</div>
                </div>
                <div className={`font-mono tabular-nums text-sm sm:text-[15px] font-semibold shrink-0 text-right ${amtColor}`}>
                  {fmtMoney(Math.abs(r.net), currency)}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
              </button>
            );
          })}
        </div>
      </CardContent>



      <Dialog open={!!active} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6 gap-3 sm:gap-4">
          {active && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="pr-8 break-words">{active.name}</DialogTitle>
                <DialogDescription>
                  {active.net === 0
                    ? "All settled."
                    : active.net > 0
                      ? `${active.name} owes you ${fmtMoney(active.net, currency)}.`
                      : `You owe ${active.name} ${fmtMoney(-active.net, currency)}.`}
                </DialogDescription>
              </DialogHeader>

              {/* Big net summary */}
              <div className={`rounded-lg border p-3 sm:p-4 flex items-center justify-between gap-3 ${
                active.net > 0 ? "bg-emerald-500/5 border-emerald-500/30" :
                active.net < 0 ? "bg-rose-500/5 border-rose-500/30" :
                "bg-muted/40"
              }`}>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Net balance</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {active.net === 0 ? "Settled" : active.net > 0 ? "In your favor" : "You owe"}
                  </div>
                </div>
                <div className={`font-mono tabular-nums text-xl sm:text-2xl font-bold shrink-0 ${
                  active.net > 0 ? "text-emerald-500" : active.net < 0 ? "text-rose-500" : "text-muted-foreground"
                }`}>
                  {fmtMoney(Math.abs(active.net), currency)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
                <div className="rounded-md border p-2.5 sm:p-3 min-w-0">
                  <div className="text-[11px] text-muted-foreground">They lent you</div>
                  <div className="font-mono tabular-nums font-semibold text-sm truncate">{fmtMoney(active.lentToMe, currency)}</div>
                </div>
                <div className="rounded-md border p-2.5 sm:p-3 min-w-0">
                  <div className="text-[11px] text-muted-foreground">You repaid them</div>
                  <div className="font-mono tabular-nums font-semibold text-sm truncate">{fmtMoney(active.repaidByMe, currency)}</div>
                </div>
                <div className="rounded-md border p-2.5 sm:p-3 min-w-0">
                  <div className="text-[11px] text-muted-foreground">You lent them</div>
                  <div className="font-mono tabular-nums font-semibold text-sm truncate">{fmtMoney(active.lentByMe, currency)}</div>
                </div>
                <div className="rounded-md border p-2.5 sm:p-3 min-w-0">
                  <div className="text-[11px] text-muted-foreground">They repaid you</div>
                  <div className="font-mono tabular-nums font-semibold text-sm truncate">{fmtMoney(active.repaidToMe, currency)}</div>
                </div>
              </div>

              {(active.iOweNet > 0 || active.owedToMeNet > 0) && (
                <div className="flex flex-col sm:flex-row gap-2">
                  {active.iOweNet > 0 && (
                    <SettleUpDialog
                      profileId={profileId}
                      direction="i_owe"
                      counterpartyId={active.id === "__unassigned__" ? null : active.id}
                      personName={active.name}
                      outstanding={active.iOweNet}
                      accounts={accounts}
                      currency={currency}
                      onDone={onChanged}
                    />
                  )}
                  {active.owedToMeNet > 0 && (
                    <SettleUpDialog
                      profileId={profileId}
                      direction="owed_to_me"
                      counterpartyId={active.id === "__unassigned__" ? null : active.id}
                      personName={active.name}
                      outstanding={active.owedToMeNet}
                      accounts={accounts}
                      currency={currency}
                      onDone={onChanged}
                    />
                  )}
                </div>
              )}


              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">History</div>
                <div className="divide-y rounded-md border">
                  {active.loans.length === 0 && (
                    <div className="py-4 text-center text-xs text-muted-foreground">No loans.</div>
                  )}
                  {active.loans.map((l) => {
                    const repaid = tx
                      .filter((t) => t.linked_loan_id === l.id && (t.kind === "repayment_in" || t.kind === "repayment_out"))
                      .reduce((s, t) => s + Number(t.amount), 0);
                    const outstanding = Math.max(0, Number(l.principal) - repaid);
                    return (
                      <div key={l.id} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {l.direction === "i_owe" ? "I owe" : "Owed to me"}
                            </Badge>
                            <span className="text-muted-foreground">{l.started_on}</span>
                            {l.status === "closed" && <Badge variant="secondary" className="text-[10px]">Closed</Badge>}
                          </div>
                          {l.note && <div className="text-muted-foreground mt-0.5 truncate italic">{l.note}</div>}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="font-mono tabular-nums">{fmtMoney(l.principal, currency)}</div>
                          {outstanding > 0 && l.status === "open" && (
                            <div className="text-[10px] text-muted-foreground">Outstanding {fmtMoney(outstanding, currency)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SettleUpDialog({
  profileId, direction, counterpartyId, personName, outstanding, accounts, currency, onDone,
}: {
  profileId: string;
  direction: "i_owe" | "owed_to_me";
  counterpartyId: string | null;
  personName: string;
  outstanding: number;
  accounts: Account[];
  currency: string;
  onDone: () => void;
}) {
  const settle = useServerFn(settlePersonalLoansFn);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(outstanding.toFixed(2)));
  const [accountId, setAccountId] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const iOwe = direction === "i_owe";
  const amt = Number(amount) || 0;
  const over = amt > outstanding + 0.004;

  const run = async () => {
    setBusy(true);
    try {
      const res: any = await settle({
        data: {
          profileId, direction, counterpartyId,
          amount: Math.min(amt, outstanding),
          occurredOn,
          accountId: accountId || null,
          note: note || (iOwe ? `Bulk repayment to ${personName}` : `Bulk repayment from ${personName}`),
        },
      });
      toast.success(
        `Settled ${fmtMoney(res?.applied ?? amt, currency)} across ${res?.loansPaid ?? 0} loan(s)` +
        (res?.loansClosed ? ` — ${res.loansClosed} closed` : ""),
      );
      onDone();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to settle");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setAmount(outstanding.toFixed(2)); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant={iOwe ? "default" : "secondary"} className="flex-1 min-w-0">
          <HandCoins className="h-3.5 w-3.5" />
          <span className="truncate">{iOwe ? "Pay off" : "Collect"} {fmtMoney(outstanding, currency)}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle>{iOwe ? "Pay off" : "Collect from"} {personName}</DialogTitle>
          <DialogDescription>
            One amount spread across all open loans, oldest first. Fully repaid loans close automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <div className="flex items-center justify-between">
              <Label>Amount</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs"
                onClick={() => setAmount(outstanding.toFixed(2))}>
                Full {fmtMoney(outstanding, currency)}
              </Button>
            </div>
            <Input type="number" step="0.01" min="0" className="text-right font-mono text-base"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
            {over && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400">
                Higher than outstanding — only {fmtMoney(outstanding, currency)} will be applied.
              </div>
            )}
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label>Date</Label>
            <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label>Account</Label>
            <Select value={accountId || NONE} onValueChange={(v) => setAccountId(v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy || !(amt > 0)} onClick={run}>
            {busy ? "Saving…" : `Settle ${fmtMoney(Math.min(amt, outstanding), currency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

