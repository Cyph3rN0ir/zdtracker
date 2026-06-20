import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { addMemberFn, listMembersFn, removeMemberFn } from "@/lib/zt.functions";
import { listUsersFn } from "@/lib/auth.functions";
import { ErrorBox } from "./_app.index";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, X } from "lucide-react";

export const Route = createFileRoute("/_app/businesses/$id/people")({
  component: People,
});

const ROLES = ["owner", "investor", "member"] as const;

function People() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext() as any;
  const list = useServerFn(listMembersFn);
  const add = useServerFn(addMemberFn);
  const remove = useServerFn(removeMemberFn);
  const listAllUsers = useServerFn(listUsersFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["members", id], queryFn: () => list({ data: { businessId: id } }) });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => listAllUsers(),
    enabled: me.role === "admin",
  });
  const [sel, setSel] = useState<{ userId: string; role: typeof ROLES[number] }>({ userId: "", role: "owner" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => add({ data: { businessId: id, userId: sel.userId, role: sel.role } }),
    onSuccess: () => {
      toast.success("Member added");
      setSel({ userId: "", role: sel.role });
      setFormErr(null);
      qc.invalidateQueries({ queryKey: ["members", id] });
    },
    onError: (e: any) => { const msg = e?.message ?? "Failed to add member"; setFormErr(msg); toast.error(msg); },
  });
  const dm = useMutation({
    mutationFn: (mid: string) => remove({ data: { id: mid } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["members", id] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove"),
  });

  const grouped: Record<string, any[]> = { owner: [], investor: [], member: [] };
  (q.data ?? []).forEach((m: any) => grouped[m.role_in_business]?.push(m));

  return (
    <div className="space-y-6">
      {me.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a person</CardTitle>
            <CardDescription>Assign an existing user a role in this business.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!sel.userId) return setFormErr("Pick a user");
                if (!sel.role) return setFormErr("Pick a role");
                setFormErr(null);
                m.mutate();
              }}
              className="flex flex-col md:flex-row md:items-end gap-3"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <Label htmlFor="add-user">User</Label>
                <Select value={sel.userId} onValueChange={(v) => setSel({ ...sel, userId: v })}>
                  <SelectTrigger id="add-user" className="h-9"><SelectValue placeholder="Select a user…" /></SelectTrigger>
                  <SelectContent>
                    {(users.data ?? []).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username}{u.display_name ? ` — ${u.display_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:w-44">
                <Label htmlFor="add-role">Role</Label>
                <Select value={sel.role} onValueChange={(v) => setSel({ ...sel, role: v as any })}>
                  <SelectTrigger id="add-role" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={m.isPending || !sel.userId} className="h-9 w-full md:w-auto shrink-0">
                <UserPlus className="h-4 w-4" /> Add
              </Button>
              {formErr && <p className="text-xs text-destructive md:basis-full">{formErr}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {q.error && <ErrorBox error={q.error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLES.map((r) => (
          <Card key={r}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="capitalize text-sm">{r}s</CardTitle>
              <Badge variant="secondary">{grouped[r].length}</Badge>
            </CardHeader>
            <CardContent>
              {grouped[r].length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  No {r}s yet.
                  {me.role === "admin" && <div className="mt-1 text-[11px]">Use the form above to add one.</div>}
                </div>
              ) : (
                <ul className="divide-y divide-border -mx-2">
                  {grouped[r].map((m) => (
                    <li key={m.id} className="px-2 py-2 flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{m.user?.username ?? "(deleted)"}</div>
                        {m.user?.display_name && (
                          <div className="truncate text-xs text-muted-foreground">{m.user.display_name}</div>
                        )}
                      </div>
                      {me.role === "admin" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate(m.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
