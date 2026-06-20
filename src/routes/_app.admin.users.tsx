import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminCreateUserFn, adminDeleteUserFn, listUsersFn } from "@/lib/auth.functions";
import { PageHeader, ErrorBox, EmptyState } from "./_app.index";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_app/admin/users")({
  beforeLoad: ({ context }) => {
    if ((context as any).me?.role !== "admin") throw new Error("Forbidden");
  },
  component: UsersPage,
  head: () => ({ meta: [{ title: "Users — ZeroTrack" }] }),
});

function UsersPage() {
  const list = useServerFn(listUsersFn);
  const create = useServerFn(adminCreateUserFn);
  const del = useServerFn(adminDeleteUserFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: () => list() });
  const [form, setForm] = useState({ username: "", password: "", role: "member" as const, displayName: "" });
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (d: any) => create({ data: d }),
    onSuccess: () => {
      setForm({ username: "", password: "", role: "member", displayName: "" });
      setErr(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => setErr(e?.message ?? "Failed"),
  });
  const dm = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Users" subtitle="Create accounts. Share credentials privately." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New user</CardTitle>
          <CardDescription>Set a username, password, and role.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); m.mutate(form); }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["admin", "owner", "investor", "member"].map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between gap-3">
              {err && <span className="text-xs text-destructive">{err}</span>}
              <Button type="submit" disabled={m.isPending} className="ml-auto">
                <UserPlus className="h-4 w-4" /> Create user
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All users</CardTitle>
          <CardDescription>{q.data?.length ?? 0} total</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground p-6">Loading…</div>
          ) : q.error ? (
            <div className="p-6"><ErrorBox error={q.error} /></div>
          ) : q.data && q.data.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Username</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12 pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono pl-6">{u.username}</TableCell>
                    <TableCell>{u.display_name}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{u.role}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right pr-6">
                      {u.username !== "admin" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => { if (confirm(`Delete ${u.username}?`)) dm.mutate(u.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6"><EmptyState message="No users yet." /></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
