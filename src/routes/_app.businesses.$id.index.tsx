import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTransactionsFn } from "@/lib/zt.functions";
import { fmt } from "./_app.personal.$id";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat label="Invested" value={totals.investment ?? 0} icon={<PiggyBank className="h-4 w-4" />} />
      <Stat label="Earnings" value={totals.earning ?? 0} icon={<TrendingUp className="h-4 w-4" />} />
      <Stat label="Expenses" value={totals.expense ?? 0} icon={<TrendingDown className="h-4 w-4" />} />
      <Stat label="Profit" sub="earnings − expenses" value={profit} icon={<Wallet className="h-4 w-4" />} accent />
    </div>
  );
}

function Stat({
  label, value, sub, accent, icon,
}: { label: string; value: number; sub?: string; accent?: boolean; icon: React.ReactNode }) {
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
