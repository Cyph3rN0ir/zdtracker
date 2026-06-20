import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addTransactionFn, deleteTransactionFn, listMembersFn, listTransactionsFn } from "@/lib/zt.functions";
import { fmt } from "./_app.personal.$id";

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
      else if (t.kind === "profit_distribution") {
        distributions += n;
        distRows.push(t);
      }
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
          businessId: id,
          kind: "profit_distribution",
          amount: Number(form.amount),
          partyUserId: form.partyUserId || null,
          note: form.note,
          occurredOn: form.occurredOn,
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
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat label="Earnings" value={earnings} />
        <Stat label="Expenses" value={expenses} />
        <Stat label="Profit" value={profit} accent />
        <Stat label="Remaining (after distribution)" value={remaining} />
      </div>

      <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">
        Profit distribution log — separate from investments and expenses.
      </div>

      {me.role === "admin" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(form.amount) > 0) m.mutate();
          }}
          className="grid grid-cols-[140px_1fr_180px_140px_auto] gap-2 items-end mb-4 border border-border p-3"
        >
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
          <Field label="Recipient">
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
            Record
          </button>
        </form>
      )}

      <div className="border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium w-28">Date</th>
              <th className="px-3 py-2 font-medium w-40">Recipient</th>
              <th className="px-3 py-2 font-medium">Note</th>
              <th className="px-3 py-2 font-medium text-right w-32">Amount</th>
              {me.role === "admin" && <th className="w-12"></th>}
            </tr>
          </thead>
          <tbody>
            {distRows.length === 0 ? (
              <tr>
                <td colSpan={me.role === "admin" ? 5 : 4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No distributions yet.
                </td>
              </tr>
            ) : (
              distRows.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono text-xs">{t.occurred_on}</td>
                  <td className="px-3 py-1.5">{t.party?.username ?? "—"}</td>
                  <td className="px-3 py-1.5">{t.note}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmt(t.amount)}</td>
                  {me.role === "admin" && (
                    <td className="px-3 py-1.5 text-right">
                      <button onClick={() => dm.mutate(t.id)} className="text-xs text-destructive hover:underline">
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
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={"border border-border p-4 " + (accent ? "bg-muted" : "")}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-mono mt-2">{fmt(value)}</div>
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
