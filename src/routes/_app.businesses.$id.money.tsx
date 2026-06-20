import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { addTransactionFn, deleteTransactionFn, listMembersFn, listTransactionsFn } from "@/lib/zt.functions";
import { ErrorBox } from "./_app.index";
import { fmt } from "./_app.personal.$id";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Wallet, UserPlus } from "lucide-react";
import { useI18n, roleLabel } from "@/lib/i18n";

export const Route = createFileRoute("/_app/businesses/$id/money")({
  component: Money,
});

type Kind = "investment" | "earning" | "expense";
const KINDS: Kind[] = ["investment", "earning", "expense"];

function Money() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext() as any;
  const { t } = useI18n();
  const list = useServerFn(listTransactionsFn);
  const add = useServerFn(addTransactionFn);
  const del = useServerFn(deleteTransactionFn);
  const listMembers = useServerFn(listMembersFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["btx", id], queryFn: () => list({ data: { businessId: id } }) });
  const members = useQuery({ queryKey: ["members", id], queryFn: () => listMembers({ data: { businessId: id } }) });

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<{ kind: Kind; amount: string; partyUserId: string; note: string; occurredOn: string }>({
    kind: "investment", amount: "", partyUserId: "", note: "", occurredOn: today,
  });
  const [formErr, setFormErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      add({
        data: {
          businessId: id, kind: form.kind, amount: Number(form.amount),
          partyUserId: form.partyUserId || null, note: form.note, occurredOn: form.occurredOn,
        },
      }),
    onSuccess: () => {
      toast.success(t("money.toast.added"));
      setForm({ ...form, amount: "", note: "" });
      setFormErr(null);
      qc.invalidateQueries({ queryKey: ["btx", id] });
    },
    onError: (e: any) => {
      const msg = e?.message ?? t("money.toast.failed");
      setFormErr(msg);
      toast.error(msg);
    },
  });
  const dm = useMutation({
    mutationFn: (tid: string) => del({ data: { id: tid } }),
    onSuccess: () => { toast.success(t("money.toast.deleted")); qc.invalidateQueries({ queryKey: ["btx", id] }); },
    onError: (e: any) => toast.error(e?.message ?? t("money.toast.deleteFailed")),
  });

  function submitTx(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.amount || Number.isNaN(amt)) return setFormErr(t("money.err.amount"));
    if (amt <= 0) return setFormErr(t("money.err.positive"));
    if (form.kind !== "expense" && !form.partyUserId) return setFormErr(t("money.err.party"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.occurredOn)) return setFormErr(t("money.err.date"));
    setFormErr(null);
    m.mutate();
  }

  const byKind = useMemo(() => {
    const r: Record<Kind, any[]> = { investment: [], earning: [], expense: [] };
    (q.data ?? []).forEach((t: any) => { if (r[t.kind as Kind]) r[t.kind as Kind].push(t); });
    return r;
  }, [q.data]);

  return (
    <div className="space-y-6">
      {me.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("money.record")}</CardTitle>
            <CardDescription>{t("money.recordDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitTx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div className="space-y-1.5">
                <Label>{t("money.kind")}</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => <SelectItem key={k} value={k}>{t(`money.kind.${k}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.amount")}</Label>
                <Input type="number" step="0.01" min="0" required className="text-right font-mono"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t("common.note")}</Label>
                <Input maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("money.party")}</Label>
                <Select value={form.partyUserId || "none"} onValueChange={(v) => setForm({ ...form, partyUserId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {(members.data ?? []).map((mem: any) => (
                      <SelectItem key={mem.user_id} value={mem.user_id}>
                        {mem.user?.username} ({roleLabel(mem.role_in_business, t)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.date")}</Label>
                <Input type="date" value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} />
              </div>
              <div className="md:col-span-6 flex items-center justify-between gap-3 flex-wrap">
                {formErr ? <p className="text-xs text-destructive">{formErr}</p> : <span />}
                <Button type="submit" disabled={m.isPending}>
                  <Plus className="h-4 w-4" /> {t("money.addTx")}
                </Button>
              </div>
            </form>
            {(members.data ?? []).length === 0 && (
              <div className="mt-3 rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
                <span>{t("money.tipAddPeople")}</span>
                <Button asChild size="sm" variant="outline">
                  <Link to="/businesses/$id/people" params={{ id }}>
                    <UserPlus className="h-3.5 w-3.5" /> {t("money.addPeople")}
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {q.error && <ErrorBox error={q.error} />}

      <div className="grid grid-cols-1 gap-4">
        {KINDS.map((k) => (
          <Section key={k} title={t(`money.section.${k}`)} rows={byKind[k]} onDelete={me.role === "admin" ? (tid) => dm.mutate(tid) : undefined} />
        ))}
      </div>
    </div>
  );
}

function Section({ title, rows, onDelete }: { title: string; rows: any[]; onDelete?: (id: string) => void }) {
  const { t } = useI18n();
  const total = rows.reduce((s, t) => s + Number(t.amount), 0);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="text-sm font-mono whitespace-nowrap">{t("common.total")}: {fmt(total)}</div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32 pl-6">{t("common.date")}</TableHead>
              <TableHead className="w-40">{t("money.party")}</TableHead>
              <TableHead>{t("common.note")}</TableHead>
              <TableHead className="text-right w-32">{t("common.amount")}</TableHead>
              {onDelete && <TableHead className="w-12 pr-6"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={onDelete ? 5 : 4} className="text-center py-6 text-muted-foreground text-xs">{t("common.none")}</TableCell></TableRow>
            ) : rows.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-mono text-xs pl-6">{tx.occurred_on}</TableCell>
                <TableCell>{tx.party?.username ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{tx.note}</TableCell>
                <TableCell className="text-right font-mono">{fmt(tx.amount)}</TableCell>
                {onDelete && (
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(tx.id)}>
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
  );
}
