import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addPersonalTxExFn, deletePersonalTxFn, updatePersonalTxFn,
} from "@/lib/zt.functions";
import { runOrQueue } from "@/lib/offline-queue";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import {
  TX_KINDS, TX_KIND_LABEL, TxKind, TxRow, fmtMoney, todayISO, txDirection,
} from "@/lib/personal-finance";

type Cat = { id: string; name: string; kind: "income" | "expense" };
type Account = { id: string; name: string; type: string };
type Cp = { id: string; name: string };
type Loan = { id: string; direction: "i_owe" | "owed_to_me"; principal: number | string };

const ALL = "__all__";
const NONE = "__none__";

export function PersonalTransactions({
  profileId, tx, accounts, categories, counterparties, loans, currency,
}: {
  profileId: string;
  tx: TxRow[];
  accounts: Account[];
  categories: Cat[];
  counterparties: Cp[];
  loans: Loan[];
  currency: string;
}) {
  const qc = useQueryClient();
  const addEx = useServerFn(addPersonalTxExFn);
  const upd = useServerFn(updatePersonalTxFn);
  const del = useServerFn(deletePersonalTxFn);

  // Offline runner for addPersonalTxEx is registered once at the route
  // layout level (see _app.personal.$id.tsx) so queued writes still replay
  // even when the user is on a different tab when connectivity returns.

  const [form, setForm] = useState({
    kind: "expense" as TxKind,
    amount: "",
    note: "",
    occurredOn: todayISO(),
    accountId: "",
    categoryId: "",
    counterpartyId: "",
    transferAccountId: "",
    linkedLoanId: "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["personal-tx", profileId] });
    qc.invalidateQueries({ queryKey: ["personal-loans", profileId] });
  };

  const add = useMutation({
    mutationFn: () =>
      runOrQueue("addPersonalTxEx", {
        profileId,
        kind: form.kind,
        amount: Number(form.amount),
        note: form.note,
        occurredOn: form.occurredOn,
        accountId: form.accountId || null,
        categoryId: form.categoryId || null,
        counterpartyId: form.counterpartyId || null,
        transferAccountId: form.transferAccountId || null,
        linkedLoanId: form.linkedLoanId || null,
      }),
    onSuccess: (res: any) => {
      if (res?.queued) toast.success("Saved offline — will sync when back online");
      else toast.success("Transaction added");
      setForm({ ...form, amount: "", note: "" });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add"),
  });

  const dm = useMutation({
    mutationFn: (id: string) => del({ data: { id, profileId } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
  });

  // Filters
  const [filter, setFilter] = useState({ kind: ALL, accountId: ALL, categoryId: ALL, q: "" });
  const filtered = useMemo(() => {
    return tx.filter((t) => {
      if (filter.kind !== ALL && t.kind !== filter.kind) return false;
      if (filter.accountId !== ALL && t.account_id !== filter.accountId) return false;
      if (filter.categoryId !== ALL && t.category_id !== filter.categoryId) return false;
      if (filter.q && !(t.note ?? "").toLowerCase().includes(filter.q.toLowerCase())) return false;
      return true;
    });
  }, [tx, filter]);

  const acctName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "";
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";
  const cpName = (id: string | null) => counterparties.find((c) => c.id === id)?.name ?? "";

  const showCategory = form.kind === "income" || form.kind === "expense";
  const showCounterparty = ["expense", "income", "loan_given", "loan_taken", "repayment_in", "repayment_out"].includes(form.kind);
  const showTransfer = form.kind === "transfer";
  const showLoan = form.kind === "repayment_in" || form.kind === "repayment_out";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const updMut = useMutation({
    mutationFn: (t: TxRow) =>
      upd({
        data: {
          id: t.id, profileId, kind: t.kind,
          amount: Number(editAmount), note: editNote, occurredOn: t.occurred_on,
          accountId: t.account_id, categoryId: t.category_id, counterpartyId: t.counterparty_id,
          transferAccountId: t.transfer_account_id, linkedLoanId: t.linked_loan_id,
        },
      }),
    onSuccess: () => { setEditingId(null); invalidate(); toast.success("Updated"); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add transaction</CardTitle>
          <CardDescription>Pick a kind — extra fields appear as needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); if (Number(form.amount) > 0) add.mutate(); }}
            className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
          >
            <Field label="Kind" className="md:col-span-1">
              <Select value={form.kind} onValueChange={(v) => {
                const k = v as TxKind;
                setForm({
                  ...form, kind: k,
                  categoryId: (k === "income" || k === "expense") ? form.categoryId : "",
                  transferAccountId: k === "transfer" ? form.transferAccountId : "",
                  linkedLoanId: (k === "repayment_in" || k === "repayment_out") ? form.linkedLoanId : "",
                });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TX_KINDS.map((k) => <SelectItem key={k} value={k}>{TX_KIND_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount" className="md:col-span-1">
              <Input type="number" step="0.01" min="0" required className="text-right font-mono"
                value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Date" className="md:col-span-1">
              <Input type="date" value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} />
            </Field>
            <Field label="Account" className="md:col-span-1">
              <Select value={form.accountId || NONE} onValueChange={(v) => setForm({ ...form, accountId: v === NONE ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {showCategory && (
              <Field label="Category" className="md:col-span-1">
                <Select value={form.categoryId || NONE} onValueChange={(v) => setForm({ ...form, categoryId: v === NONE ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {categories
                      .filter((c) => c.kind === (form.kind === "income" ? "income" : "expense"))
                      .map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {showCounterparty && (
              <Field label="Person / vendor" className="md:col-span-1">
                <Select value={form.counterpartyId || NONE} onValueChange={(v) => setForm({ ...form, counterpartyId: v === NONE ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {counterparties.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {showTransfer && (
              <Field label="To account" className="md:col-span-1">
                <Select value={form.transferAccountId || NONE} onValueChange={(v) => setForm({ ...form, transferAccountId: v === NONE ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {accounts.filter((a) => a.id !== form.accountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {showLoan && (
              <Field label="Linked loan" className="md:col-span-1">
                <Select value={form.linkedLoanId || NONE} onValueChange={(v) => setForm({ ...form, linkedLoanId: v === NONE ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {loans.map((l) => <SelectItem key={l.id} value={l.id}>{l.direction === "i_owe" ? "I owe" : "Owed to me"} · {fmtMoney(l.principal, currency)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Note" className="md:col-span-3">
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <div className="md:col-span-6 flex justify-end">
              <Button type="submit" disabled={add.isPending}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Transactions</CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={filter.kind} onValueChange={(v) => setFilter({ ...filter, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All kinds</SelectItem>
                {TX_KINDS.map((k) => <SelectItem key={k} value={k}>{TX_KIND_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filter.accountId} onValueChange={(v) => setFilter({ ...filter, accountId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All accounts</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filter.categoryId} onValueChange={(v) => setFilter({ ...filter, categoryId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Search note…" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No matching transactions.</div>}
            {filtered.map((t) => {
              const dir = txDirection(t.kind);
              const sign = dir === "in" ? "+" : dir === "out" ? "−" : "";
              const color = dir === "in" ? "text-emerald-500" : dir === "out" ? "text-rose-500" : "text-muted-foreground";
              const editing = editingId === t.id;
              return (
                <div key={t.id} className="cv-auto px-3 py-2.5 sm:px-4 text-sm flex flex-col gap-1.5 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center">
                  <div className="flex items-center justify-between gap-2 sm:contents">
                    <div className="flex items-center gap-2 min-w-0 sm:col-span-2">
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">{t.occurred_on}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <Badge variant="secondary" className="text-[10px]">{TX_KIND_LABEL[t.kind]}</Badge>
                    </div>
                  </div>
                  <div className="min-w-0 sm:col-span-4">
                    {editing ? (
                      <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} className="h-7" />
                    ) : (
                      <span className="text-muted-foreground block truncate">
                        {t.note || [catName(t.category_id), acctName(t.account_id), cpName(t.counterparty_id)].filter(Boolean).join(" · ") || "—"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:contents">
                    <div className={`font-mono tabular-nums text-right [overflow-wrap:anywhere] min-w-0 sm:col-span-2 ${color}`}>
                      {editing ? (
                        <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="h-7 text-right font-mono" />
                      ) : (
                        <>{sign}{fmtMoney(t.amount, currency)}</>
                      )}
                    </div>
                    <div className="flex justify-end gap-1 sm:col-span-2">
                      {editing ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updMut.mutate(t)}><Check className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : (
                        <>
                          <EditTxDialog
                            tx={t} profileId={profileId} accounts={accounts}
                            categories={categories} counterparties={counterparties} loans={loans}
                            currency={currency} onSaved={invalidate}
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                            title="Quick edit amount & note"
                            onClick={() => { setEditingId(t.id); setEditAmount(String(t.amount)); setEditNote(t.note ?? ""); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => dm.mutate(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function EditTxDialog({
  tx, profileId, accounts, categories, counterparties, loans, currency, onSaved,
}: {
  tx: TxRow; profileId: string;
  accounts: Account[]; categories: Cat[]; counterparties: Cp[]; loans: Loan[];
  currency: string; onSaved: () => void;
}) {
  const upd = useServerFn(updatePersonalTxFn);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TxKind>(tx.kind);
  const [amount, setAmount] = useState(String(tx.amount));
  const [note, setNote] = useState(tx.note ?? "");
  const [occurredOn, setOccurredOn] = useState(tx.occurred_on);
  const [accountId, setAccountId] = useState(tx.account_id ?? "");
  const [categoryId, setCategoryId] = useState(tx.category_id ?? "");
  const [counterpartyId, setCounterpartyId] = useState(tx.counterparty_id ?? "");
  const [transferAccountId, setTransferAccountId] = useState(tx.transfer_account_id ?? "");
  const [linkedLoanId, setLinkedLoanId] = useState(tx.linked_loan_id ?? "");
  const [busy, setBusy] = useState(false);

  const showCategory = kind === "income" || kind === "expense";
  const showCounterparty = ["expense","income","loan_given","loan_taken","repayment_in","repayment_out"].includes(kind);
  const showTransfer = kind === "transfer";
  const showLoan = kind === "repayment_in" || kind === "repayment_out";

  const save = async () => {
    if (!(Number(amount) >= 0)) return;
    setBusy(true);
    try {
      await upd({
        data: {
          id: tx.id, profileId, kind,
          amount: Number(amount), note, occurredOn,
          accountId: accountId || null,
          categoryId: showCategory ? (categoryId || null) : null,
          counterpartyId: showCounterparty ? (counterpartyId || null) : null,
          transferAccountId: showTransfer ? (transferAccountId || null) : null,
          linkedLoanId: showLoan ? (linkedLoanId || null) : null,
        },
      });
      toast.success("Transaction updated");
      onSaved();
      setOpen(false);
    } catch (e: any) { toast.error(e?.message ?? "Failed to update"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Edit all fields"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit transaction</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select value={kind} onValueChange={(v) => setKind(v as TxKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TX_KINDS.map((k) => <SelectItem key={k} value={k}>{TX_KIND_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Amount">
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-right font-mono" />
          </Field>
          <Field label="Date">
            <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </Field>
          <Field label="Account">
            <Select value={accountId || NONE} onValueChange={(v) => setAccountId(v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {showCategory && (
            <Field label="Category">
              <Select value={categoryId || NONE} onValueChange={(v) => setCategoryId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {categories.filter((c) => c.kind === (kind === "income" ? "income" : "expense")).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          {showCounterparty && (
            <Field label="Person / vendor">
              <Select value={counterpartyId || NONE} onValueChange={(v) => setCounterpartyId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {counterparties.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          {showTransfer && (
            <Field label="To account">
              <Select value={transferAccountId || NONE} onValueChange={(v) => setTransferAccountId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {accounts.filter((a) => a.id !== accountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          {showLoan && (
            <Field label="Linked loan">
              <Select value={linkedLoanId || NONE} onValueChange={(v) => setLinkedLoanId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {loans.map((l) => <SelectItem key={l.id} value={l.id}>{l.direction === "i_owe" ? "I owe" : "Owed to me"} · {fmtMoney(l.principal, currency)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Note" className="col-span-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

