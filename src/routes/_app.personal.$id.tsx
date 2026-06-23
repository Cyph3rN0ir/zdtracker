import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getPersonalProfileFn, listPersonalTxExFn,
  listPersonalAccountsFn, upsertPersonalAccountFn, deletePersonalAccountFn,
  listPersonalCategoriesFn,
  listPersonalCounterpartiesFn, upsertPersonalCounterpartyFn,
  listPersonalLoansFn,
  listPersonalBudgetsFn, upsertPersonalBudgetFn, deletePersonalBudgetFn,
} from "@/lib/zt.functions";
import { PageHeader, ErrorBox } from "./_app.index";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { PersonalOverview } from "@/components/personal/Overview";
import { PersonalTransactions } from "@/components/personal/Transactions";
import { PersonalLoans } from "@/components/personal/Loans";
import { PersonalCategories } from "@/components/personal/Categories";
import { computeBudgetStatus, fmtMoney, todayISO, BudgetRow, TxRow } from "@/lib/personal-finance";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/personal/$id")({
  component: PersonalDetail,
  head: () => ({ meta: [{ title: "Profile — ZeroSync" }] }),
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

  const currency = "INR";

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

  const err = prof.error || tx.error || accts.error || cats.error || cps.error || loans.error || budgets.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title={prof.data?.name ?? "Profile"}
        subtitle="Personal ledger — fully separate from business accounts."
        right={
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/personal"><ChevronLeft className="h-3.5 w-3.5" /> All profiles</Link>
          </Button>
        }
      />

      {err && <ErrorBox error={err} />}

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="-mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tx">Transactions</TabsTrigger>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>
        </div>

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
  const qc = useQueryClient();
  const upsert = useServerFn(upsertPersonalAccountFn);
  const del = useServerFn(deletePersonalAccountFn);
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [opening, setOpening] = useState("");
  const add = useMutation({
    mutationFn: () => upsert({ data: { profileId, name, type: type as any, openingBalance: Number(opening || 0), currency, archived: false } }),
    onSuccess: () => { setName(""); setOpening(""); toast.success("Account added"); qc.invalidateQueries({ queryKey: ["personal-accts", profileId] }); },
  });
  const dm = useMutation({
    mutationFn: (id: string) => del({ data: { id, profileId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-accts", profileId] }),
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add account</CardTitle><CardDescription>Cash, bank, card, wallet, savings, investment…</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
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
              <div key={a.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{a.type}</Badge>
                  <span className="font-medium">{a.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-muted-foreground">{fmtMoney(a.opening_balance, currency)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
  const qc = useQueryClient();
  const upsert = useServerFn(upsertPersonalBudgetFn);
  const del = useServerFn(deletePersonalBudgetFn);
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const add = useMutation({
    mutationFn: () => upsert({ data: { profileId, name, period, amount: Number(amount), categoryId: categoryId || null, startDate: todayISO(), active: true } }),
    onSuccess: () => { setName(""); setAmount(""); setCategoryId(""); toast.success("Budget added"); qc.invalidateQueries({ queryKey: ["personal-budgets", profileId] }); },
  });
  const dm = useMutation({
    mutationFn: (id: string) => del({ data: { id, profileId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-budgets", profileId] }),
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add budget</CardTitle><CardDescription>Weekly or monthly cap. Leave category empty to track overall expenses.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (name && Number(amount) > 0) add.mutate(); }} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
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
            <Card key={b.id}>
              <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  <CardDescription>{b.period} · {categories.find((c) => c.id === b.category_id)?.name ?? "overall"}</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div className={`text-2xl font-mono font-semibold ${tone}`}>{fmtMoney(Math.max(0, s.remaining), currency)}</div>
                  <div className="text-xs text-muted-foreground font-mono">{fmtMoney(s.spent, currency)} / {fmtMoney(s.limit, currency)}</div>
                </div>
                <Progress value={s.pct} className="mt-2 h-2" />
                <div className="mt-1 text-xs text-muted-foreground">{s.daysLeft} days left · projected {fmtMoney(s.projected, currency)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CounterpartiesTab({ profileId, counterparties }: { profileId: string; counterparties: any[] }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertPersonalCounterpartyFn);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("person");
  const add = useMutation({
    mutationFn: () => upsert({ data: { profileId, name, kind: kind as any, note: "" } }),
    onSuccess: () => { setName(""); toast.success("Added"); qc.invalidateQueries({ queryKey: ["personal-cps", profileId] }); },
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add person / vendor</CardTitle><CardDescription>Who you pay, who pays you, who owes you.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
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
            {counterparties.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <Badge variant="secondary" className="capitalize">{c.kind}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

