import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createBusinessFn, deleteBusinessFn, listBusinessesFn } from "@/lib/zt.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowRight, Plus, Building2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — ZeroSync" }] }),
});

function Dashboard() {
  const { me } = Route.useRouteContext() as any;
  const list = useServerFn(listBusinessesFn);
  const create = useServerFn(createBusinessFn);
  const del = useServerFn(deleteBusinessFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["businesses"], queryFn: () => list() });
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: () => create({ data: { name: name.trim() } }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Business deleted");
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Businesses" subtitle="All businesses you have access to." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {me.role === "admin" && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">New business</CardTitle>
              <CardDescription>Create a workspace for tracking money & tasks.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) m.mutate();
                }}
                className="flex flex-col gap-2"
              >
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Coffee Co."
                />
                <Button type="submit" disabled={m.isPending || !name.trim()} className="w-full">
                  <Plus className="h-4 w-4" />
                  Create business
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className={me.role === "admin" ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">All businesses</CardTitle>
              <CardDescription>{q.data?.length ?? 0} total</CardDescription>
            </div>
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {q.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : q.error ? (
              <ErrorBox error={q.error} />
            ) : q.data && q.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-24 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/businesses/$id" params={{ id: b.id }}>
                            Open <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                message={me.role === "admin" ? "No businesses yet. Create one to get started." : "No businesses assigned to you yet."}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      <div>{message}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: any }) {
  const msg = error?.message ?? String(error);
  const pfHint = /personal_(transactions|accounts|categories|counterparties|loans|budgets)|account_id|category_id|counterparty_id|linked_loan_id|transfer_account_id/i.test(msg);
  const missingTable = /does not exist|schema cache|relation .* does not exist/i.test(msg);
  return (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        <div>{msg}</div>
        {pfHint ? (
          <div className="text-xs opacity-70 mt-2">
            Personal-finance schema is missing. Run <code>SUPABASE_PERSONAL_FINANCE.sql</code> in your Supabase SQL editor (idempotent, safe to re-run).
          </div>
        ) : missingTable ? (
          <div className="text-xs opacity-70 mt-2">
            Missing table. Run <code>SUPABASE_SETUP.sql</code> (and then <code>SUPABASE_PERSONAL_FINANCE.sql</code> if you use the personal tracker) in your Supabase SQL editor.
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
