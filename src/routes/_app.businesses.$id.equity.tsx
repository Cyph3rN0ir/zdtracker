import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { listMembersFn, setMemberEquityFn } from "@/lib/zt.functions";
import { useI18n } from "@/lib/i18n";
import { ErrorBox } from "@/components/ErrorBox";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PieChart, Pencil } from "lucide-react";

const EquityDonut = lazy(() =>
  import("@/components/business/EquityChart").then((m) => ({ default: m.EquityDonut })),
);

export const Route = createFileRoute("/_app/businesses/$id/equity")({
  component: Equity,
});

const PALETTE = [
  "#B6D733",
  "#4f9cf9",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
  "#a78bfa",
  "#14b8a6",
  "#f97316",
  "#e11d48",
  "#64748b",
];

function pct(n: number) {
  const v = Math.round(n * 100) / 100;
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}%`;
}

function Equity() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext() as any;
  const { t } = useI18n();
  const list = useServerFn(listMembersFn);
  const save = useServerFn(setMemberEquityFn);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["members", id],
    queryFn: () => list({ data: { businessId: id } }),
  });

  const members = (q.data ?? []) as any[];

  const { slices, allocated, unallocated } = useMemo(() => {
    const byUser = new Map<string, { id: string; name: string; value: number; role: string }>();
    for (const m of members) {
      const key = m.user_id;
      const name = m.user?.display_name || m.user?.username || t("equity.unknown", "Unknown user");
      const prev = byUser.get(key);
      const value = Number(m.equity_percent ?? 0);
      if (prev) prev.value += value;
      else byUser.set(key, { id: key, name, value, role: m.role_in_business });
    }
    const rows = Array.from(byUser.values())
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = rows.reduce((a, r) => a + r.value, 0);
    const s = rows.map((r, i) => ({ ...r, color: PALETTE[i % PALETTE.length] }));
    const rest = Math.max(0, 100 - total);
    if (rest > 0.001) {
      s.push({
        id: "__unallocated",
        name: t("equity.unallocated", "Unallocated"),
        value: rest,
        role: "",
        color: "var(--muted)",
      });
    }
    return { slices: s, allocated: total, unallocated: rest };
  }, [members, t]);

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const draftTotal = Object.values(draft).reduce((a, v) => a + (Number(v) || 0), 0);

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          businessId: id,
          entries: Object.entries(draft).map(([mid, v]) => ({
            id: mid,
            equityPercent: Number(v) || 0,
          })),
        },
      }),
    onSuccess: () => {
      toast.success(t("equity.toast.saved", "Equity updated"));
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["members", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? t("common.error", "Something went wrong")),
  });

  const openEdit = () => {
    setDraft(
      Object.fromEntries(members.map((x) => [x.id, String(Number(x.equity_percent ?? 0) || 0)])),
    );
    setEditOpen(true);
  };

  const canManage = me?.role === "admin";

  return (
    <div className="space-y-4 sm:space-y-6">
      {q.isError && !q.data && !q.isFetching && <ErrorBox error={q.error} />}

      <SectionCard
        title={t("equity.title", "Equity ownership")}
        description={t("equity.desc", "Share of the company held by each person")}
        right={
          canManage ? (
            <Button size="sm" variant="outline" className="h-10 w-full sm:h-8 sm:w-auto" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" /> {t("equity.edit", "Edit shares")}
            </Button>
          ) : undefined
        }
      >
        {q.isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : members.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {t("equity.empty", "Add people to this business first, then assign their equity.")}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-5 md:gap-6 items-center">
            <div className="relative mx-auto h-52 w-52 sm:h-60 sm:w-60 min-w-0">
              <Suspense fallback={<Skeleton className="h-full w-full rounded-full" />}>
                <EquityDonut data={slices} />
              </Suspense>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold">
                  {pct(allocated)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t("equity.allocated", "allocated")}
                </span>
              </div>
            </div>

            <ul className="min-w-0 space-y-2.5">
              {slices.map((s) => (
                <li key={s.id} className="min-w-0">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: s.color }}
                      />
                      <span className="truncate">{s.name}</span>
                      {s.role ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {s.role}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-sm font-medium">
                      {pct(s.value)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, s.value)}%`, background: s.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      {members.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <MiniStat label={t("equity.holders", "Holders")} value={String(slices.filter((s) => s.id !== "__unallocated").length)} />
          <MiniStat label={t("equity.allocatedTotal", "Allocated")} value={pct(allocated)} />
          <MiniStat label={t("equity.unallocated", "Unallocated")} value={pct(unallocated)} />
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("equity.edit", "Edit shares")}</DialogTitle>
            <DialogDescription>
              {t("equity.editDesc", "Set each person's percentage. The total cannot exceed 100%.")}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draftTotal > 100.001) {
                toast.error(t("equity.tooMuch", "Total equity cannot exceed 100%"));
                return;
              }
              m.mutate();
            }}
            className="space-y-3"
          >
            <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
              {members.map((x) => (
                <div key={x.id} className="flex items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`eq-${x.id}`} className="block truncate text-xs">
                      {x.user?.display_name || x.user?.username || "(deleted)"}
                      <span className="ml-1 text-muted-foreground">({x.role_in_business})</span>
                    </Label>
                  </div>
                  <div className="relative w-28 shrink-0">
                    <Input
                      id={`eq-${x.id}`}
                      inputMode="decimal"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="h-9 pr-7 text-base sm:text-sm"
                      value={draft[x.id] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [x.id]: e.target.value }))}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
                draftTotal > 100.001 ? "border-destructive text-destructive" : "border-border text-muted-foreground"
              }`}
            >
              <span>{t("equity.total", "Total")}</span>
              <span className="font-mono tabular-nums">{pct(draftTotal)}</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={m.isPending || draftTotal > 100.001}>
                {t("common.save", "Save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <PieChart className="h-3 w-3" /> <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 font-mono tabular-nums text-base sm:text-lg font-semibold truncate">
        {value}
      </div>
    </div>
  );
}
