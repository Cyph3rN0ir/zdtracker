import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  addPersonalTxFn, deletePersonalTxFn, getPersonalProfileFn, listPersonalTxFn,
} from "@/lib/zt.functions";
import { PageHeader, ErrorBox } from "./_app.index";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/personal/$id")({
  component: PersonalDetail,
  head: () => ({ meta: [{ title: "Profile — ZeroSync" }] }),
});

const KINDS = ["earning", "expense", "debt", "repayment"] as const;
type Kind = (typeof KINDS)[number];

function PersonalDetail() {
  const { id } = Route.useParams();
  const getProf = useServerFn(getPersonalProfileFn);
  const listTx = useServerFn(listPersonalTxFn);
  const addTx = useServerFn(addPersonalTxFn);
  const delTx = useServerFn(deletePersonalTxFn);
  const qc = useQueryClient();
  const prof = useQuery({ queryKey: ["personal", id], queryFn: () => getProf({ data: { id } }) });
  const tx = useQuery({ queryKey: ["personal-tx", id], queryFn: () => listTx({ data: { profileId: id } }) });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<{ kind: Kind; amount: string; note: string; occurredOn: string }>({
    kind: "earning", amount: "", note: "", occurredOn: today,
  });
  const m = useMutation({
    mutationFn: () =>
      addTx({ data: { profileId: id, kind: form.kind, amount: Number(form.amount), note: form.note, occurredOn: form.occurredOn } }),
    onSuccess: () => {
      setForm({ kind: form.kind, amount: "", note: "", occurredOn: today });
      qc.invalidateQueries({ queryKey: ["personal-tx", id] });
    },
  });
  const dm = useMutation({
    mutationFn: (tid: string) => delTx({ data: { id: tid, profileId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-tx", id] }),
  });

  const totals: Record<string, number> = (tx.data ?? []).reduce(
    (acc: Record<string, number>, t: any) => ({ ...acc, [t.kind]: (acc[t.kind] ?? 0) + Number(t.amount) }),
    {} as Record<string, number>,
  );

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {KINDS.map((k) => (
          <Card key={k}>
            <CardHeader className="pb-1.5">
              <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{k}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-mono font-semibold">{fmt(totals[k] ?? 0)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add transaction</CardTitle>
          <CardDescription>Logged immediately to this profile only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (Number(form.amount) > 0) m.mutate(); }}
            className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
              <Label>Date</Label>
              <Input type="date" value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button type="submit" disabled={m.isPending}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {tx.error && <ErrorBox error={tx.error} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32 pl-6">Date</TableHead>
                <TableHead className="w-28">Kind</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right w-32">Amount</TableHead>
                <TableHead className="w-12 pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tx.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No transactions yet.</TableCell></TableRow>
              ) : (tx.data ?? []).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs pl-6">{t.occurred_on}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{t.kind}</Badge></TableCell>
                  <TableCell>{t.note}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(t.amount)}</TableCell>
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function fmt(n: number | string) {
  const v = Number(n);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
