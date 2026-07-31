import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  businessAccountBalancesFn,
  deleteBusinessAccountFn,
  transferBusinessFundsFn,
  upsertBusinessAccountFn,
} from "@/lib/zt.functions";
import { fmt } from "@/lib/personal-finance";
import { ErrorBox } from "@/components/ErrorBox";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Banknote,
  CreditCard,
  Landmark,
  MoreVertical,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  ArrowLeftRight,
  Circle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/businesses/$id/accounts")({
  component: Accounts,
});

type AcctType = "cash" | "bank" | "wallet" | "card" | "investment" | "savings" | "other";
const TYPES: AcctType[] = ["cash", "bank", "wallet", "card", "investment", "savings", "other"];

function typeIcon(t: string) {
  const cls = "h-4 w-4";
  switch (t) {
    case "cash": return <Banknote className={cls} />;
    case "bank": return <Landmark className={cls} />;
    case "wallet": return <Wallet className={cls} />;
    case "card": return <CreditCard className={cls} />;
    case "investment": return <TrendingUp className={cls} />;
    case "savings": return <PiggyBank className={cls} />;
    default: return <Circle className={cls} />;
  }
}

const emptyForm = {
  id: undefined as string | undefined,
  name: "",
  type: "cash" as AcctType,
  openingBalance: "0",
  currency: "BDT",
};

function Accounts() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext() as any;
  const { t } = useI18n();
  const isAdmin = me?.role === "admin";

  const balances = useServerFn(businessAccountBalancesFn);
  const upsert = useServerFn(upsertBusinessAccountFn);
  const del = useServerFn(deleteBusinessAccountFn);
  const transfer = useServerFn(transferBusinessFundsFn);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["baccounts", id],
    queryFn: () => balances({ data: { businessId: id } }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [xferOpen, setXferOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["baccounts", id] });
    qc.invalidateQueries({ queryKey: ["btx", id] });
  };

  const saveM = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: form.id,
          businessId: id,
          name: form.name.trim(),
          type: form.type,
          openingBalance: Number(form.openingBalance || 0),
          currency: form.currency.trim() || "BDT",
          archived: false,
        },
      }),
    onSuccess: () => {
      toast.success(t("bacct.toast.saved", "Account saved"));
      setOpen(false);
      setForm(emptyForm);
      invalidate();
    },
    onError: (e: any) => {
      const msg = e?.message ?? t("bacct.toast.failed", "Failed to save account");
      setFormErr(msg);
      toast.error(msg);
    },
  });

  const delM = useMutation({
    mutationFn: (aid: string) => del({ data: { id: aid, businessId: id } }),
    onSuccess: () => {
      toast.success(t("bacct.toast.deleted", "Account deleted"));
      setDelId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? t("common.error", "Something went wrong")),
  });

  const accounts = q.data?.accounts ?? [];
  const active = useMemo(() => accounts.filter((a: any) => !a.archived), [accounts]);

  return (
    <div className="space-y-5">
      <SectionCard
        title={t("bacct.total", "Total assets")}
        description={t("bacct.totalDesc", "Across all accounts of this business")}
        right={
          isAdmin ? (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
              <Button
                size="sm"
                variant="outline"
                disabled={active.length < 2}
                onClick={() => setXferOpen(true)}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" /> {t("bacct.transfer", "Transfer")}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setForm(emptyForm);
                  setFormErr(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> {t("bacct.add", "Add account")}
              </Button>
            </div>
          ) : null
        }
      >
        <div className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold break-words">
          {fmt(q.data?.total ?? 0)}
        </div>
        {!!q.data?.unassigned && (
          <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {t("bacct.unassigned", "Unassigned transactions")}: {fmt(q.data.unassigned)}
          </p>
        )}
      </SectionCard>

      {q.data?.schemaPending && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {t(
            "bacct.pending",
            "Accounts setup is pending — run SUPABASE_BUSINESS_ACCOUNTS.sql in Supabase to enable this tab.",
          )}
        </p>
      )}

      {q.isError && !q.data && !q.isFetching && <ErrorBox error={q.error} />}

      {accounts.length === 0 && !q.isLoading ? (
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          message={t("bacct.empty", "No accounts yet")}
          hint={t("bacct.emptyHint", "Add cash, bank or wallet accounts to track where the money sits.")}
          action={
            isAdmin ? (
              <Button size="sm" onClick={() => { setForm(emptyForm); setOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> {t("bacct.add", "Add account")}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a: any) => (
            <SectionCard key={a.id} className="min-w-0 overflow-hidden">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">{typeIcon(a.type)}</span>
                    <span className="font-medium truncate">{a.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      {t(`bacct.type.${a.type}`, a.type)}
                    </Badge>
                    {a.archived && (
                      <Badge variant="outline" className="text-[10px]">
                        {t("bacct.archived", "Archived")}
                      </Badge>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onSelect={() => {
                          setForm({
                            id: a.id,
                            name: a.name,
                            type: a.type,
                            openingBalance: String(a.opening_balance ?? 0),
                            currency: a.currency ?? "BDT",
                          });
                          setFormErr(null);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDelId(a.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="mt-3 font-mono tabular-nums text-lg sm:text-xl font-semibold break-words">
                {fmt(a.balance)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 [overflow-wrap:anywhere]">
                {t("bacct.opening", "Opening")}: {fmt(a.opening_balance ?? 0)}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? t("bacct.editTitle", "Edit account") : t("bacct.add", "Add account")}
            </DialogTitle>
            <DialogDescription>
              {t("bacct.dialogDesc", "Track where this business keeps its money.")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) return setFormErr(t("bacct.err.name", "Enter an account name"));
              if (Number.isNaN(Number(form.openingBalance || 0)))
                return setFormErr(t("bacct.err.opening", "Enter a valid opening balance"));
              setFormErr(null);
              saveM.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>{t("common.name")}</Label>
              <Input
                value={form.name}
                maxLength={80}
                autoFocus
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("bacct.typeLabel", "Type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AcctType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((ty) => (
                      <SelectItem key={ty} value={ty}>{t(`bacct.type.${ty}`, ty)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("bacct.opening", "Opening")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="text-right font-mono tabular-nums"
                  value={form.openingBalance}
                  onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                />
              </div>
            </div>
            {formErr && <p className="text-xs text-destructive break-words">{formErr}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saveM.isPending}>{t("common.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TransferDialog
        open={xferOpen}
        onOpenChange={setXferOpen}
        accounts={active}
        onSubmit={(payload) =>
          transfer({ data: { businessId: id, ...payload } })
            .then(() => {
              toast.success(t("bacct.toast.transferred", "Transfer recorded"));
              setXferOpen(false);
              invalidate();
            })
            .catch((e: any) => toast.error(e?.message ?? t("bacct.toast.transferFailed", "Transfer failed")))
        }
      />

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bacct.delTitle", "Delete this account?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bacct.delDesc", "Transactions stay, but they will no longer be linked to any account.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => delId && delM.mutate(delId)}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TransferDialog({
  open,
  onOpenChange,
  accounts,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accounts: any[];
  onSubmit: (p: { fromAccountId: string; toAccountId: string; amount: number; note: string; occurredOn: string }) => void;
}) {
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bacct.transfer", "Transfer")}</DialogTitle>
          <DialogDescription>
            {t("bacct.transferDesc", "Move money between two accounts. Totals stay unchanged.")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const amt = Number(amount);
            if (!from || !to) return setErr(t("bacct.err.accounts", "Pick both accounts"));
            if (from === to) return setErr(t("bacct.err.sameAccount", "Pick two different accounts"));
            if (!amount || Number.isNaN(amt) || amt <= 0) return setErr(t("money.err.positive"));
            setErr(null);
            onSubmit({ fromAccountId: from, toAccountId: to, amount: amt, note, occurredOn: date });
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("bacct.from", "From")}</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("bacct.to", "To")}</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("common.amount")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="text-right font-mono tabular-nums"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.note")}</Label>
            <Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {err && <p className="text-xs text-destructive break-words">{err}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("bacct.transfer", "Transfer")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
