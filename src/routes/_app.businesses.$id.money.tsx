import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { addTransactionFn, deleteTransactionFn, listMembersFn, listTransactionsFn } from "@/lib/zt.functions";
import { ErrorBox } from "@/components/ErrorBox";
import { fmt } from "@/lib/personal-finance";
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
              <div className="md:col-span-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                {formErr ? <p className="text-xs text-destructive break-words">{formErr}</p> : <span className="hidden sm:block" />}
                <Button type="submit" disabled={m.isPending} className="w-full sm:w-auto shrink-0">
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

      {q.isError && !q.data && !q.isFetching && <ErrorBox error={q.error} />}

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
      <CardHeader className="gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base break-words min-w-0">{title}</CardTitle>
        <div className="text-sm font-mono whitespace-nowrap text-muted-foreground sm:text-foreground">{t("common.total")}: {fmt(total)}</div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs px-4">{t("common.none")}</div>
        ) : (
          <>
            {/* Mobile: stacked card list */}
            <ul className="divide-y sm:hidden">
              {rows.map((tx) => (
                <li key={tx.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{tx.occurred_on}</span>
                      <span>·</span>
                      <span className="truncate">{tx.party?.username ?? "—"}</span>
                    </div>
                    {tx.note && <div className="break-words">{tx.note}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="font-mono text-sm">{fmt(tx.amount)}</div>
                    {onDelete && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(tx.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop: table */}
            <div className="hidden sm:block">
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
                  {rows.map((tx) => (
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
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
