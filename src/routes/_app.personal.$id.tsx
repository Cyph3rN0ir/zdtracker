import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  addPersonalTxFn,
  deletePersonalTxFn,
  getPersonalProfileFn,
  listPersonalTxFn,
} from "@/lib/zt.functions";
import { PageHeader, ErrorBox } from "./_app.index";

export const Route = createFileRoute("/_app/personal/$id")({
  component: PersonalDetail,
  head: () => ({ meta: [{ title: "Profile — ZeroTrack" }] }),
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
    kind: "earning",
    amount: "",
    note: "",
    occurredOn: today,
  });
  const m = useMutation({
    mutationFn: () =>
      addTx({
        data: {
          profileId: id,
          kind: form.kind,
          amount: Number(form.amount),
          note: form.note,
          occurredOn: form.occurredOn,
        },
      }),
    onSuccess: () => {
      setForm({ kind: form.kind, amount: "", note: "", occurredOn: today });
      qc.invalidateQueries({ queryKey: ["personal-tx", id] });
    },
  });
  const dm = useMutation({
    mutationFn: (tid: string) => delTx({ data: { id: tid, profileId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-tx", id] }),
  });

  const totals = (tx.data ?? []).reduce(
    (acc: Record<string, number>, t: any) => ({ ...acc, [t.kind]: (acc[t.kind] ?? 0) + Number(t.amount) }),
    {} as Record<string, number>,
  );

  return (
    <div>
      <PageHeader
        title={prof.data?.name ?? "Profile"}
        subtitle="Personal ledger — fully separate from business accounts."
        right={
          <Link to="/personal" className="text-xs text-muted-foreground hover:underline">
            ← All profiles
          </Link>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        {KINDS.map((k) => (
          <Stat key={k} label={k} value={totals[k] ?? 0} />
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(form.amount) > 0) m.mutate();
        }}
        className="grid grid-cols-[120px_140px_1fr_140px_auto] gap-2 mb-6 items-end"
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

      {tx.error && <ErrorBox error={tx.error} />}
      <div className="border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium w-28">Date</th>
              <th className="px-3 py-2 font-medium w-28">Kind</th>
              <th className="px-3 py-2 font-medium">Note</th>
              <th className="px-3 py-2 font-medium text-right w-32">Amount</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {(tx.data ?? []).map((t: any) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{t.occurred_on}</td>
                <td className="px-3 py-2 text-xs uppercase">{t.kind}</td>
                <td className="px-3 py-2">{t.note}</td>
                <td className="px-3 py-2 text-right font-mono">{fmt(t.amount)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => dm.mutate(t.id)} className="text-xs text-destructive hover:underline">
                    Del
                  </button>
                </td>
              </tr>
            ))}
            {(tx.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-mono mt-1">{fmt(value)}</div>
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
export function fmt(n: number | string) {
  const v = Number(n);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
