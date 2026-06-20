import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTransactionsFn } from "@/lib/zt.functions";
import { fmt } from "./_app.personal.$id";

export const Route = createFileRoute("/_app/businesses/$id/")({
  component: Overview,
});

function Overview() {
  const { id } = Route.useParams();
  const list = useServerFn(listTransactionsFn);
  const q = useQuery({ queryKey: ["btx", id], queryFn: () => list({ data: { businessId: id } }) });
  const totals = (q.data ?? []).reduce(
    (a: any, t: any) => ({ ...a, [t.kind]: (a[t.kind] ?? 0) + Number(t.amount) }),
    {} as Record<string, number>,
  );
  const profit = (totals.earning ?? 0) - (totals.expense ?? 0);
  return (
    <div className="grid grid-cols-4 gap-3">
      <Stat label="Invested" value={totals.investment ?? 0} />
      <Stat label="Earnings" value={totals.earning ?? 0} />
      <Stat label="Expenses" value={totals.expense ?? 0} />
      <Stat label="Profit (earnings − expenses)" value={profit} accent />
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
