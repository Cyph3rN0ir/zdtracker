import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteBusinessFn, getBusinessFn, renameBusinessFn } from "@/lib/zt.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ChevronLeft, MoreVertical, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/businesses/$id")({
  component: BusinessLayout,
});

const TABS = [
  { key: "overview", label: "Overview", to: "/businesses/$id" },
  { key: "people", label: "People", to: "/businesses/$id/people" },
  { key: "money", label: "Money", to: "/businesses/$id/money" },
  { key: "accounts", label: "Accounts", to: "/businesses/$id/accounts" },
  { key: "profit", label: "Profit", to: "/businesses/$id/profit" },
  { key: "tasks", label: "Tasks", to: "/businesses/$id/tasks" },

] as const;

function BusinessLayout() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext() as any;
  const get = useServerFn(getBusinessFn);
  const del = useServerFn(deleteBusinessFn);
  const ren = useServerFn(renameBusinessFn);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["business", id], queryFn: () => get({ data: { id } }) });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState("");
  const [delOpen, setDelOpen] = useState(false);

  const delM = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Business deleted");
      qc.invalidateQueries({ queryKey: ["businesses"] });
      navigate({ to: "/" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const renM = useMutation({
    mutationFn: (name: string) => ren({ data: { id, name } }),
    onSuccess: () => {
      toast.success("Renamed");
      setRenameOpen(false);
      qc.invalidateQueries({ queryKey: ["business", id] });
      qc.invalidateQueries({ queryKey: ["businesses"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to rename"),
  });

  const active =
    TABS.slice()
      .reverse()
      .find((t) => pathname.startsWith(t.to.replace("$id", id)))?.key ?? "overview";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 text-muted-foreground">
          <Link to="/">
            <ChevronLeft className="h-3.5 w-3.5" />
            All businesses
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight min-w-0 truncate">
            {q.data?.name ?? "…"}
          </h1>
          {me?.role === "admin" && q.data && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0" aria-label="Business actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onSelect={() => {
                    setRenameVal(q.data!.name);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setDelOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <Tabs value={active}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} asChild>
                <Link to={t.to} params={{ id }}>{t.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename business</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = renameVal.trim();
              if (v) renM.mutate(v);
            }}
            className="space-y-3"
          >
            <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={renM.isPending || !renameVal.trim()}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{q.data?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the business and all its members, money transactions, and tasks.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => delM.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Outlet />
    </div>
  );
}
