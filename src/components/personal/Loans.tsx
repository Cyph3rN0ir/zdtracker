import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  upsertPersonalLoanFn, deletePersonalLoanFn, addPersonalTxExFn,
} from "@/lib/zt.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, HandCoins } from "lucide-react";
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
        <Card>
          <CardHeader className="pb-1.5"><CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">I owe (open)</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-mono font-semibold text-rose-500">{fmtMoney(totalOwedByMe, currency)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1.5"><CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Owed to me (open)</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-mono font-semibold text-emerald-500">{fmtMoney(totalOwedToMe, currency)}</div></CardContent>
        </Card>
      </div>

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
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:contents">
                      <div className="sm:col-span-2 text-xs text-muted-foreground">Principal<br /><span className="font-mono text-foreground">{fmtMoney(l.principal, currency)}</span></div>
                      <div className="sm:col-span-2 text-xs text-muted-foreground">Repaid<br /><span className="font-mono text-foreground">{fmtMoney(repaid, currency)}</span></div>
                      <div className="sm:col-span-2 text-xs text-muted-foreground">Outstanding<br /><span className={`font-mono ${outstanding > 0 ? "text-foreground" : "text-emerald-500"}`}>{fmtMoney(outstanding, currency)}</span></div>
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
                  <span className="font-mono">{fmtMoney(l.principal, currency)}</span>
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
