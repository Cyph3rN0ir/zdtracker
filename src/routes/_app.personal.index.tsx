import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createPersonalProfileFn,
  deletePersonalProfileFn,
  listPersonalProfilesFn,
  renamePersonalProfileFn,
} from "@/lib/zt.functions";
import { PageHeader, ErrorBox, EmptyState } from "./_app.index";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ArrowRight, Plus, User, MoreVertical, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/personal/")({
  component: PersonalList,
  head: () => ({ meta: [{ title: "Personal — ZeroSync" }] }),
});

function PersonalList() {
  const list = useServerFn(listPersonalProfilesFn);
  const create = useServerFn(createPersonalProfileFn);
  const del = useServerFn(deletePersonalProfileFn);
  const rename = useServerFn(renamePersonalProfileFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["personal"], queryFn: () => list() });
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const m = useMutation({
    mutationFn: () => create({ data: { name: name.trim() } }),
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["personal"] }); },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Profile deleted");
      qc.invalidateQueries({ queryKey: ["personal"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });
  const renameM = useMutation({
    mutationFn: (input: { id: string; name: string }) => rename({ data: input }),
    onSuccess: () => {
      toast.success("Profile renamed");
      setRenameTarget(null);
      qc.invalidateQueries({ queryKey: ["personal"] });
      qc.invalidateQueries({ queryKey: ["personal-profile"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to rename"),
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Personal profiles" subtitle="Track your own money, separate from any business." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New profile</CardTitle>
            <CardDescription>One per ledger you want to keep.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) m.mutate(); }} className="flex flex-col gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Profile name" />
              <Button type="submit" disabled={m.isPending || !name.trim()}>
                <Plus className="h-4 w-4" /> Create
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">All profiles</CardTitle>
              <CardDescription>{q.data?.length ?? 0} total</CardDescription>
            </div>
            <User className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {q.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : q.isError && !q.data && !q.isFetching ? (
              <ErrorBox error={q.error} />
            ) : q.data && q.data.length ? (
              <ul className="divide-y rounded-md border">
                {q.data.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Created {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/personal/$id" params={{ id: p.id }}>
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" aria-label={`Actions for ${p.name}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onSelect={() => {
                              setRenameTarget({ id: p.id, name: p.name });
                              setRenameValue(p.name);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDeleteTarget({ id: p.id, name: p.name })}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No personal profiles yet." />
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the profile and all its accounts, transactions, categories,
              counterparties, loans, and budgets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) delM.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
