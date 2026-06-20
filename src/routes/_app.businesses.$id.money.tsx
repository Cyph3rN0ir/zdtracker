import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addTransactionFn, deleteTransactionFn, listMembersFn, listTransactionsFn } from "@/lib/zt.functions";
import { ErrorBox } from "./_app.index";
import { fmt } from "./_app.personal.$id";

export const Route = createFileRoute("/_app/businesses/$id/money")({
  component: Money,
});

type Kind = "investment" | "earning" | "expense";
const KINDS: Kind[] = ["investment", "earning", "expense"];

function Money() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext() as any;
  const list = useServerFn(listTransactionsFn);
  const add = useServerFn(addTransactionFn);
  const del = useServerFn(deleteTransactionFn);
  const listMembers = useServerFn(listMembersFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["btx", id], queryFn: () => list({ data: { businessId: id } }) });
  const members = useQuery({ queryKey: ["members", id], queryFn: () => listMembers({ data: { businessId: id } }) });

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<{ kind: Kind; amount: string; partyUserId: string; note: string; occurredOn: string }>({
    kind: "investment",
    amount: "",
    partyUserId: "",
    note: "",
    occurredOn: today,
  });
  const m = useMutation({
    mutationFn: () =>
      add({
        data: {
          businessId: id,
          kind: form.kind,
          amount: Number(form.amount),
          partyUserId: form.partyUserId || null,
          note: form.note,
          occurredOn: form.occurredOn,
        },
      }),
    onSuccess: () => {
      setForm({ ...form, amount: "", note: "" });
      qc.invalidateQueries({ queryKey: ["btx", id] });
    },
  });
  const dm = useMutation({
    mutationFn: (tid: string) => del({ data: { id: tid } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["btx", id] }),
  });

  const byKind = useMemo(() => {
    const r: Record<Kind, any[]> = { investment: [], earning: [], expense: [] };
    (q.data ?? []).forEach((t: any) => {
      if (r[t.kind as Kind]) r[t.kind as Kind].push(t);
    });
    return r;
  }, [q.data]);

  return (
    <div>
      {(me.role === "admin") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(form.amount) > 0) m.mutate();
          }}
          className="grid grid-cols-[120px_140px_1fr_180px_140px_auto] gap-2 items-end mb-6 border border-border p-3"
        >
          <Field label="Kind">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
              className="w-full border border-input px-2 py-1.5 text-sm bg-background"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full border border-input px-2 py-1.5 text-sm text-right"
              required
            />
          </Field>
          <Field label="Note">
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full border border-input px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Party (optional)">
            <select
              value={form.partyUserId}
              onChange={(e) => setForm({ ...form, partyUserId: e.target.value })}
              className="w-full border border-input px-2 py-1.5 text-sm bg-background"
            >
              <option value="">—</option>
              {(members.data ?? []).map((mem: any) => (
                <option key={mem.user_id} value={mem.user_id}>
                  {mem.user?.username} ({mem.role_in_business})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={form.occurredOn}
              onChange={(e) => setForm({ ...form, occurredOn: e.target.value })}
              className="w-full border border-input px-2 py-1.5 text-sm"
            />
          </Field>
          <button className="bg-primary text-primary-foreground px-3 py-1.5 text-sm" disabled={m.isPending}>
            Add
          </button>
        </form>
      )}

      {q.error && <ErrorBox error={q.error} />}

      <div className="space-y-6">
        {KINDS.map((k) => (
          <Section key={k} title={k} rows={byKind[k]} onDelete={me.role === "admin" ? (tid) => dm.mutate(tid) : undefined} />
        ))}
      </div>
    </div>
  );
}

function Section({ title, rows, onDelete }: { title: string; rows: any[]; onDelete?: (id: string) => void }) {
  const total = rows.reduce((s, t) => s + Number(t.amount), 0);
  return (
    <div className="border border-border">
      <div className="bg-muted px-3 py-2 flex justify-between items-center">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{title}s</span>
        <span className="text-sm font-mono">Total: {fmt(total)}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 font-medium w-28">Date</th>
            <th className="px-3 py-1.5 font-medium w-40">Party</th>
            <th className="px-3 py-1.5 font-medium">Note</th>
            <th className="px-3 py-1.5 font-medium text-right w-32">Amount</th>
            {onDelete && <th className="w-12"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={onDelete ? 5 : 4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                None.
              </td>
            </tr>
          ) : (
            rows.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-1.5 font-mono text-xs">{t.occurred_on}</td>
                <td className="px-3 py-1.5">{t.party?.username ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-1.5">{t.note}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(t.amount)}</td>
                {onDelete && (
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => onDelete(t.id)} className="text-xs text-destructive hover:underline">
                      Del
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
