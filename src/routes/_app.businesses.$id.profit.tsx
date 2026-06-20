import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addTransactionFn, deleteTransactionFn, listMembersFn, listTransactionsFn } from "@/lib/zt.functions";
import { fmt } from "./_app.personal.$id";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, TrendingUp, TrendingDown, Wallet, Coins } from "lucide-react";

export const Route = createFileRoute("/_app/businesses/$id/profit")({
  component: Profit,
});

function Profit() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext() as any;
  const list = useServerFn(listTransactionsFn);
  const add = useServerFn(addTransactionFn);
  const del = useServerFn(deleteTransactionFn);
  const listMembers = useServerFn(listMembersFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["btx", id], queryFn: () => list({ data: { businessId: id } }) });
  const members = useQuery({ queryKey: ["members", id], queryFn: () => listMembers({ data: { businessId: id } }) });

  const { earnings, expenses, distributions, distRows } = useMemo(() => {
    let earnings = 0, expenses = 0, distributions = 0;
    const distRows: any[] = [];
    (q.data ?? []).forEach((t: any) => {
      const n = Number(t.amount);
      if (t.kind === "earning") earnings += n;
      else if (t.kind === "expense") expenses += n;
      else if (t.kind === "profit_distribution") { distributions += n; distRows.push(t); }
    });
    return { earnings, expenses, distributions, distRows };
  }, [q.data]);

  const profit = earnings - expenses;
  const remaining = profit - distributions;

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ amount: "", partyUserId: "", note: "", occurredOn: today });
  const m = useMutation({
    mutationFn: () =>
      add({
        data: {
          businessId: id, kind: "profit_distribution", amount: Number(form.amount),
          partyUserId: form.partyUserId || null, note: form.note, occurredOn: form.occurredOn,
        },
      }),
    onSuccess: () => {
      setForm({ amount: "", partyUserId: "", note: "", occurredOn: today });
      qc.invalidateQueries({ queryKey: ["btx", id] });
    },
  });
  const dm = useMutation({
    mutationFn: (tid: string) => del({ data: { id: tid } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["btx", id] }),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Earnings" value={earnings} icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="Expenses" value={expenses} icon={<TrendingDown className="h-4 w-4" />} />
        <Stat label="Profit" value={profit} icon={<Wallet className="h-4 w-4" />} accent />
        <Stat label="Remaining" sub="after distribution" value={remaining} icon={<Coins className="h-4 w-4" />} />
      </div>

      {me.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record distribution</CardTitle>
            <CardDescription>Separate from investments and expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); if (Number(form.amount) > 0) m.mutate(); }}
              className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
            >
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0" required className="text-right font-mono"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Note</Label>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient</Label>
                <Select value={form.partyUserId || "none"} onValueChange={(v) => setForm({ ...form, partyUserId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {(members.data ?? []).map((mem: any) => (
                      <SelectItem key={mem.user_id} value={mem.user_id}>
                        {mem.user?.username} ({mem.role_in_business})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} />
              </div>
              <div className="md:col-span-5 flex justify-end">
                <Button type="submit" disabled={m.isPending}>
                  <Plus className="h-4 w-4" /> Record distribution
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribution log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32 pl-6">Date</TableHead>
                <TableHead className="w-40">Recipient</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right w-32">Amount</TableHead>
                {me.role === "admin" && <TableHead className="w-12 pr-6"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {distRows.length === 0 ? (
                <TableRow><TableCell colSpan={me.role === "admin" ? 5 : 4} className="text-center py-8 text-muted-foreground text-sm">No distributions yet.</TableCell></TableRow>
              ) : distRows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs pl-6">{t.occurred_on}</TableCell>
                  <TableCell>{t.party?.username ?? "—"}</TableCell>
                  <TableCell>{t.note}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(t.amount)}</TableCell>
                  {me.role === "admin" && (
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, accent, icon }: { label: string; value: number; sub?: string; accent?: boolean; icon: React.ReactNode }) {
  return (
    <Card className={accent ? "bg-primary text-primary-foreground border-primary" : ""}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs uppercase tracking-wide font-medium opacity-80">{label}</CardTitle>
        <span className="opacity-70">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-2xl font-semibold">{fmt(value)}</div>
        {sub && <div className="text-[11px] opacity-60 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
