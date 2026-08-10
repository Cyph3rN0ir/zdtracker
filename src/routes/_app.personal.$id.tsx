import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getPersonalProfileFn, listPersonalTxExFn,
  listPersonalAccountsFn, upsertPersonalAccountFn, deletePersonalAccountFn,
  listPersonalCategoriesFn,
  listPersonalCounterpartiesFn, upsertPersonalCounterpartyFn, deletePersonalCounterpartyFn,
  listPersonalLoansFn,
  listPersonalBudgetsFn, upsertPersonalBudgetFn, deletePersonalBudgetFn,
} from "@/lib/zt.functions";
import { PageHeader } from "@/components/PageHeader";
import { ErrorBox } from "@/components/ErrorBox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  SectionTabBar,
  SectionTabLabel,
  SectionTabTrigger,
} from "@/components/SectionTabBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeftRight,
  ChevronLeft,
  ContactRound,
  HandCoins,
  LayoutDashboard,
  Pencil,
  Plus,
  Tags,
  Target,
  Trash2,
  WalletCards,
} from "lucide-react";
import { PersonalOverview } from "@/components/personal/Overview";
import { PersonalTransactions } from "@/components/personal/Transactions";
import { PersonalLoans } from "@/components/personal/Loans";
import { PersonalCategories } from "@/components/personal/Categories";
import { computeBudgetStatus, fmtMoney, todayISO, BudgetRow, TxRow } from "@/lib/personal-finance";
import { Progress } from "@/components/ui/progress";
import { createOfflineId } from "@/lib/offline-queue";
import { OFFLINE_OPS } from "@/lib/offline-operations";
import { removeRow, updateRows, useOfflineMutation } from "@/lib/use-offline-mutation";

export const Route = createFileRoute("/_app/personal/$id")({
  component: PersonalDetail,
  head: () => ({ meta: [{ title: "Profile — ZeroSync" }] }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-md mt-16 p-6 text-center space-y-3">
        <h2 className="text-lg font-semibold">Couldn’t load this profile</h2>
        <p className="text-sm text-muted-foreground">{(error as Error)?.message ?? "Something went wrong."}</p>
        <div className="flex justify-center gap-2">
          <button className="text-sm underline" onClick={() => { router.invalidate(); reset(); }}>Try again</button>
          <Link to="/personal" className="text-sm underline">Back to profiles</Link>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-md mt-16 p-6 text-center space-y-3">
      <h2 className="text-lg font-semibold">Profile not found</h2>
      <Link to="/personal" className="text-sm underline">Back to profiles</Link>
    </div>
  ),
});

const NONE = "__none__";

function PersonalDetail() {
  const { id } = Route.useParams();
  const getProf = useServerFn(getPersonalProfileFn);
  const listTx = useServerFn(listPersonalTxExFn);
  const listAccts = useServerFn(listPersonalAccountsFn);
  const listCats = useServerFn(listPersonalCategoriesFn);
  const listCps = useServerFn(listPersonalCounterpartiesFn);
  const listLoans = useServerFn(listPersonalLoansFn);
  const listBudgets = useServerFn(listPersonalBudgetsFn);

  const prof = useQuery({ queryKey: ["personal", id], queryFn: () => getProf({ data: { id } }) });
  const tx = useQuery({ queryKey: ["personal-tx", id], queryFn: () => listTx({ data: { profileId: id } }) });
  const accts = useQuery({ queryKey: ["personal-accts", id], queryFn: () => listAccts({ data: { profileId: id } }) });
  const cats = useQuery({ queryKey: ["personal-cats", id], queryFn: () => listCats({ data: { profileId: id } }) });
  const cps = useQuery({ queryKey: ["personal-cps", id], queryFn: () => listCps({ data: { profileId: id } }) });
  const loans = useQuery({ queryKey: ["personal-loans", id], queryFn: () => listLoans({ data: { profileId: id } }) });
  const budgets = useQuery({ queryKey: ["personal-budgets", id], queryFn: () => listBudgets({ data: { profileId: id } }) });

  const currency = "BDT";

  // Budget threshold toast (per-period, per-budget, session-deduped via localStorage).
  useEffect(() => {
    if (!budgets.data || !tx.data) return;
    for (const b of budgets.data as BudgetRow[]) {
      if (!b.active) continue;
      const s = computeBudgetStatus(b, tx.data as TxRow[]);
      const level = s.pct >= 100 ? "over" : s.pct >= 75 ? "warn" : null;
      if (!level) continue;
      const key = `pf:budget:${b.id}:${s.start}:${level}`;
      if (localStorage.getItem(key)) continue;
      localStorage.setItem(key, "1");
      if (level === "over") toast.error(`${b.name} budget exceeded`, { description: `${fmtMoney(s.spent, currency)} of ${fmtMoney(s.limit, currency)}` });
      else toast.warning(`${b.name}: ${Math.round(s.pct)}% used`, { description: `${fmtMoney(s.remaining, currency)} left` });
    }
  }, [budgets.data, tx.data]);

  // Only surface a hard error after the query has actually failed (not while
  // it's still loading/retrying), and only when there's no data to show.
  // Prevents transient network/SW blips from flashing "Not found".
  const queries = [prof, tx, accts, cats, cps, loans, budgets];
  const anyFetching = queries.some((q) => q.isFetching);
  const hardErr = !anyFetching
    ? (prof.isError && !prof.data ? prof.error
      : tx.isError && !tx.data ? tx.error
      : accts.isError && !accts.data ? accts.error
      : cats.isError && !cats.data ? cats.error
      : cps.isError && !cps.data ? cps.error
      : loans.isError && !loans.data ? loans.error
      : budgets.isError && !budgets.data ? budgets.error
      : null)
    : null;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
        <Link to="/personal">
          <ChevronLeft className="h-3.5 w-3.5" />
          All profiles
        </Link>
      </Button>

      <PageHeader
        title={prof.data?.name ?? "Profile"}
        subtitle="Personal ledger — fully separate from business accounts."
      />

      {hardErr && <ErrorBox error={hardErr} />}

      <Tabs defaultValue="overview" className="space-y-4">
        <SectionTabBar label="Personal finance sections">
          <SectionTabTrigger value="overview">
            <SectionTabLabel icon={<LayoutDashboard className="h-4 w-4" />}>
              Overview
            </SectionTabLabel>
          </SectionTabTrigger>
          <SectionTabTrigger value="tx">
            <SectionTabLabel icon={<ArrowLeftRight className="h-4 w-4" />}>
              Transactions
            </SectionTabLabel>
          </SectionTabTrigger>
          <SectionTabTrigger value="loans">
            <SectionTabLabel icon={<HandCoins className="h-4 w-4" />}>
              Loans
            </SectionTabLabel>
          </SectionTabTrigger>
          <SectionTabTrigger value="accounts">
            <SectionTabLabel icon={<WalletCards className="h-4 w-4" />}>
              Accounts
            </SectionTabLabel>
          </SectionTabTrigger>
          <SectionTabTrigger value="budgets">
            <SectionTabLabel icon={<Target className="h-4 w-4" />}>
              Budgets
            </SectionTabLabel>
          </SectionTabTrigger>
          <SectionTabTrigger value="categories">
            <SectionTabLabel icon={<Tags className="h-4 w-4" />}>
              Categories
            </SectionTabLabel>
          </SectionTabTrigger>
          <SectionTabTrigger value="people">
            <SectionTabLabel icon={<ContactRound className="h-4 w-4" />}>
              People
            </SectionTabLabel>
          </SectionTabTrigger>
        </SectionTabBar>

        <TabsContent value="overview">
          <PersonalOverview
            tx={(tx.data ?? []) as TxRow[]}
            budgets={(budgets.data ?? []) as BudgetRow[]}
            categories={(cats.data ?? []) as any}
            accounts={(accts.data ?? []) as any}
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="tx">
          <PersonalTransactions
            profileId={id}
            tx={(tx.data ?? []) as TxRow[]}
            accounts={(accts.data ?? []) as any}
            categories={(cats.data ?? []) as any}
            counterparties={(cps.data ?? []) as any}
            loans={(loans.data ?? []) as any}
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="loans">
          <PersonalLoans
            profileId={id}
            loans={(loans.data ?? []) as any}
            counterparties={(cps.data ?? []) as any}
            accounts={(accts.data ?? []) as any}
            tx={(tx.data ?? []) as TxRow[]}
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsTab profileId={id} accounts={(accts.data ?? []) as any} currency={currency} />
        </TabsContent>

        <TabsContent value="budgets">
          <BudgetsTab profileId={id} budgets={(budgets.data ?? []) as BudgetRow[]} categories={(cats.data ?? []) as any} tx={(tx.data ?? []) as TxRow[]} currency={currency} />
        </TabsContent>

        <TabsContent value="categories">
          <PersonalCategories profileId={id} categories={(cats.data ?? []) as any} />
        </TabsContent>

        <TabsContent value="people">
          <CounterpartiesTab profileId={id} counterparties={(cps.data ?? []) as any} />
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ---------- Lightweight tabs (full CRUD comes in Phase 3) ----------

function AccountsTab({ profileId, accounts, currency }: { profileId: string; accounts: any[]; currency: string }) {
  const upsert = useServerFn(upsertPersonalAccountFn);
  const del = useServerFn(deletePersonalAccountFn);
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [opening, setOpening] = useState("");
  type AccountInput = { clientId?: string; id?: string; profileId: string; name: string; type: any; openingBalance: number; currency: string; archived: boolean };
  const add = useOfflineMutation<AccountInput>({
    operation: OFFLINE_OPS.PERSONAL_ACCOUNT_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["personal-accts", profileId], ["personal-tx", profileId]],
    optimisticUpdate: (client, data) => client.setQueryData<any[]>(["personal-accts", profileId], (rows) => [
      ...(rows ?? []),
      { id: data.clientId, name: data.name, type: data.type, opening_balance: data.openingBalance, currency: data.currency, archived: false, created_at: new Date().toISOString() },
    ]),
    onSuccess: (result) => { setName(""); setOpening(""); toast.success(result.queued ? "Account saved offline" : "Account added"); },
  });
  const dm = useOfflineMutation<{ id: string; profileId: string }>({
    operation: OFFLINE_OPS.PERSONAL_ACCOUNT_DELETE,
    mutationFn: (data) => del({ data }),
    affectedKeys: [["personal-accts", profileId], ["personal-tx", profileId]],
    optimisticUpdate: (client, data) => client.setQueryData<any[]>(["personal-accts", profileId], (rows) => removeRow(rows, data.id)),
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add account</CardTitle><CardDescription>Cash, bank, card, wallet, savings, investment…</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate({ clientId: createOfflineId(), profileId, name, type, openingBalance: Number(opening || 0), currency, archived: false }); }} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash","bank","wallet","card","investment","savings","other"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Opening balance</Label><Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} className="text-right font-mono" /></div>
            <Button type="submit" disabled={add.isPending}><Plus className="h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Accounts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {accounts.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No accounts yet.</div>}
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Badge variant="secondary" className="capitalize shrink-0">{a.type}</Badge>
                  <span className="font-medium truncate">{a.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-mono text-muted-foreground text-xs sm:text-sm whitespace-nowrap">{fmtMoney(a.opening_balance, currency)}</span>
                  <EditAccountDialog account={a} profileId={profileId} currency={currency} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate({ id: a.id, profileId })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BudgetsTab({ profileId, budgets, categories, tx, currency }: { profileId: string; budgets: BudgetRow[]; categories: any[]; tx: TxRow[]; currency: string }) {
  const upsert = useServerFn(upsertPersonalBudgetFn);
  const del = useServerFn(deletePersonalBudgetFn);
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  type BudgetInput = { clientId?: string; id?: string; profileId: string; name: string; period: "week" | "month"; amount: number; categoryId: string | null; startDate: string; active: boolean };
  const add = useOfflineMutation<BudgetInput>({
    operation: OFFLINE_OPS.PERSONAL_BUDGET_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["personal-budgets", profileId]],
    optimisticUpdate: (client, data) => client.setQueryData<BudgetRow[]>(["personal-budgets", profileId], (rows) => [
      { id: data.clientId!, name: data.name, period: data.period, amount: data.amount, category_id: data.categoryId, start_date: data.startDate, active: data.active },
      ...(rows ?? []),
    ]),
    onSuccess: (result) => { setName(""); setAmount(""); setCategoryId(""); toast.success(result.queued ? "Budget saved offline" : "Budget added"); },
  });
  const dm = useOfflineMutation<{ id: string; profileId: string }>({
    operation: OFFLINE_OPS.PERSONAL_BUDGET_DELETE,
    mutationFn: (data) => del({ data }),
    affectedKeys: [["personal-budgets", profileId]],
    optimisticUpdate: (client, data) => client.setQueryData<BudgetRow[]>(["personal-budgets", profileId], (rows) => removeRow(rows, data.id)),
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add budget</CardTitle><CardDescription>Weekly or monthly cap. Leave category empty to track overall expenses.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (name && Number(amount) > 0) add.mutate({ clientId: createOfflineId(), profileId, name, period, amount: Number(amount), categoryId: categoryId || null, startDate: todayISO(), active: true }); }} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="week">Weekly</SelectItem><SelectItem value="month">Monthly</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-right font-mono" /></div>
            <div className="space-y-1.5">
              <Label>Category (optional)</Label>
              <Select value={categoryId || NONE} onValueChange={(v) => setCategoryId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Overall" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Overall</SelectItem>
                  {categories.filter((c) => c.kind === "expense").map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={add.isPending}><Plus className="h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {budgets.length === 0 && <div className="md:col-span-2 py-10 text-center text-sm text-muted-foreground">No budgets yet.</div>}
        {budgets.map((b) => {
          const s = computeBudgetStatus(b, tx);
          const tone = s.pct >= 100 ? "text-rose-500" : s.pct >= 75 ? "text-amber-500" : "text-emerald-500";
          return (
            <Card key={b.id} className="min-w-0 overflow-hidden">
              <CardHeader className="pb-2 flex-row items-start justify-between gap-2 space-y-0 min-w-0">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base truncate">{b.name}</CardTitle>
                  <CardDescription className="truncate">{b.period} · {categories.find((c) => c.id === b.category_id)?.name ?? "overall"}</CardDescription>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <EditBudgetDialog budget={b} categories={categories} profileId={profileId} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate({ id: b.id, profileId })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardHeader>
              <CardContent className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 min-w-0">
                  <span className={`text-lg sm:text-2xl font-mono font-semibold tabular-nums [overflow-wrap:anywhere] min-w-0 ${tone}`}>{fmtMoney(Math.max(0, s.remaining), currency)}</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-mono tabular-nums text-right [overflow-wrap:anywhere] min-w-0">{fmtMoney(s.spent, currency)} / {fmtMoney(s.limit, currency)}</span>
                </div>
                <Progress value={s.pct} className="mt-2 h-2" />
                <div className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{s.daysLeft} days left · projected {fmtMoney(s.projected, currency)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CounterpartiesTab({ profileId, counterparties }: { profileId: string; counterparties: any[] }) {
  const upsert = useServerFn(upsertPersonalCounterpartyFn);
  const del = useServerFn(deletePersonalCounterpartyFn);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("person");
  type CounterpartyInput = { clientId?: string; id?: string; profileId: string; name: string; kind: any; note: string };
  const add = useOfflineMutation<CounterpartyInput>({
    operation: OFFLINE_OPS.PERSONAL_COUNTERPARTY_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["personal-cps", profileId]],
    optimisticUpdate: (client, data) => client.setQueryData<any[]>(["personal-cps", profileId], (rows) => [
      ...(rows ?? []),
      { id: data.clientId, name: data.name, kind: data.kind, note: data.note, created_at: new Date().toISOString() },
    ]),
    onSuccess: (result) => { setName(""); toast.success(result.queued ? "Saved offline" : "Added"); },
  });
  const dm = useOfflineMutation<{ id: string; profileId: string }>({
    operation: OFFLINE_OPS.PERSONAL_COUNTERPARTY_DELETE,
    mutationFn: (data) => del({ data }),
    affectedKeys: [["personal-cps", profileId]],
    optimisticUpdate: (client, data) => client.setQueryData<any[]>(["personal-cps", profileId], (rows) => removeRow(rows, data.id)),
    onSuccess: (result) => toast.success(result.queued ? "Deletion saved offline" : "Deleted"),
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState("person");
  const updMut = useOfflineMutation<CounterpartyInput & { id: string }>({
    operation: OFFLINE_OPS.PERSONAL_COUNTERPARTY_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["personal-cps", profileId]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: (client, data) => client.setQueryData<any[]>(["personal-cps", profileId], (rows) =>
      updateRows(rows, data.id, (row) => ({ ...row, name: data.name, kind: data.kind, note: data.note })),
    ),
    onSuccess: (result) => { setEditingId(null); toast.success(result.queued ? "Update saved offline" : "Updated"); },
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add person / vendor</CardTitle><CardDescription>Who you pay, who pays you, who owes you.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate({ clientId: createOfflineId(), profileId, name, kind, note: "" }); }} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["person","vendor","employer","other"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={add.isPending}><Plus className="h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">People & vendors</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {counterparties.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No people added yet.</div>}
            {counterparties.map((c) => {
              const editing = editingId === c.id;
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {editing ? (
                      <>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 flex-1 min-w-0" autoFocus />
                        <Select value={editKind} onValueChange={setEditKind}>
                          <SelectTrigger className="h-7 w-28 shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["person","vendor","employer","other"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <>
                        <span className="font-medium truncate">{c.name}</span>
                        <Badge variant="secondary" className="capitalize shrink-0">{c.kind}</Badge>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {editing ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updMut.mutate({ id: c.id, profileId, name: editName.trim() || c.name, kind: editKind, note: c.note ?? "" })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>×</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                          onClick={() => { setEditingId(c.id); setEditName(c.name); setEditKind(c.kind); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate({ id: c.id, profileId })}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
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

function EditAccountDialog({ account, profileId, currency }: { account: any; profileId: string; currency: string }) {
  const upsert = useServerFn(upsertPersonalAccountFn);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account.name);
  const [type, setType] = useState(account.type);
  const [opening, setOpening] = useState(String(account.opening_balance ?? 0));
  const [archived, setArchived] = useState(!!account.archived);
  type Input = { id: string; profileId: string; name: string; type: any; openingBalance: number; currency: string; archived: boolean };
  const saveM = useOfflineMutation<Input>({
    operation: OFFLINE_OPS.PERSONAL_ACCOUNT_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["personal-accts", profileId], ["personal-tx", profileId]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: (client, data) =>
      client.setQueryData<any[]>(["personal-accts", profileId], (rows) =>
        updateRows(rows, data.id, (row) => ({
          ...row,
          name: data.name,
          type: data.type,
          opening_balance: data.openingBalance,
          currency: data.currency,
          archived: data.archived,
        })),
      ),
    onSuccess: (result) => {
      toast.success(result.queued ? "Update saved offline" : "Account updated");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });
  const save = () => {
    if (!name.trim()) return;
    saveM.mutate({ id: account.id, profileId, name: name.trim(), type, openingBalance: Number(opening || 0), currency, archived });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit account</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["cash","bank","wallet","card","investment","savings","other"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Opening balance</Label>
            <Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} className="text-right font-mono" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
            Archived
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={saveM.isPending} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditBudgetDialog({ budget, categories, profileId }: { budget: BudgetRow; categories: any[]; profileId: string }) {
  const upsert = useServerFn(upsertPersonalBudgetFn);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(budget.name);
  const [period, setPeriod] = useState<"week" | "month">(budget.period as any);
  const [amount, setAmount] = useState(String(budget.amount));
  const [categoryId, setCategoryId] = useState(budget.category_id ?? "");
  const [active, setActive] = useState(!!budget.active);
  type Input = { id: string; profileId: string; name: string; period: "week" | "month"; amount: number; categoryId: string | null; startDate: string; active: boolean };
  const saveM = useOfflineMutation<Input>({
    operation: OFFLINE_OPS.PERSONAL_BUDGET_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["personal-budgets", profileId]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: (client, data) =>
      client.setQueryData<BudgetRow[]>(["personal-budgets", profileId], (rows) =>
        updateRows(rows, data.id, (row) => ({
          ...row,
          name: data.name,
          period: data.period,
          amount: data.amount,
          category_id: data.categoryId,
          start_date: data.startDate,
          active: data.active,
        })),
      ),
    onSuccess: (result) => {
      toast.success(result.queued ? "Update saved offline" : "Budget updated");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });
  const save = () => {
    if (!name.trim() || !(Number(amount) > 0)) return;
    saveM.mutate({ id: budget.id, profileId, name: name.trim(), period, amount: Number(amount), categoryId: categoryId || null, startDate: (budget as any).start_date ?? todayISO(), active });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit budget</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="week">Weekly</SelectItem><SelectItem value="month">Monthly</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-right font-mono" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Category (optional)</Label>
            <Select value={categoryId || NONE} onValueChange={(v) => setCategoryId(v === NONE ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Overall" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Overall</SelectItem>
                {categories.filter((c) => c.kind === "expense").map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={saveM.isPending} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


