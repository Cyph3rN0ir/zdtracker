import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminCreateUserFn, adminDeleteUserFn, adminUpdateUserFn, listUsersFn } from "@/lib/auth.functions";
import { PageHeader, ErrorBox, EmptyState } from "./_app.index";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Trash2, UserPlus, Pencil } from "lucide-react";
import { useI18n, roleLabel } from "@/lib/i18n";

export const Route = createFileRoute("/_app/admin/users")({
  beforeLoad: ({ context }) => {
    if ((context as any).me?.role !== "admin") throw new Error("Forbidden");
  },
  component: UsersPage,
  head: () => ({ meta: [{ title: "Users — ZeroSync" }] }),
});

const ROLES = ["admin", "owner", "investor", "member"] as const;
type Role = typeof ROLES[number];

function validateUsername(v: string, t: (k: string) => string) {
  if (!v.trim()) return t("users.err.uReq");
  if (v.length < 2) return t("users.err.uMin");
  if (v.length > 64) return t("users.err.uMax");
  if (!/^[a-zA-Z0-9_.-]+$/.test(v)) return t("users.err.uChars");
  return null;
}
function validatePassword(v: string, t: (k: string) => string, optional = false) {
  if (optional && !v) return null;
  if (v.length < 4) return t("users.err.pMin");
  if (v.length > 200) return t("users.err.pMax");
  return null;
}

function UsersPage() {
  const { t } = useI18n();
  const list = useServerFn(listUsersFn);
  const create = useServerFn(adminCreateUserFn);
  const del = useServerFn(adminDeleteUserFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: () => list() });
  const [form, setForm] = useState({ username: "", password: "", role: "member" as Role, displayName: "" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const m = useMutation({
    mutationFn: (d: any) => create({ data: d }),
    onSuccess: () => {
      toast.success(t("users.toast.created"));
      setForm({ username: "", password: "", role: "member", displayName: "" });
      setFormErr(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => { const msg = e?.message ?? t("users.toast.failed"); setFormErr(msg); toast.error(msg); },
  });
  const dm = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success(t("users.toast.deleted")); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast.error(e?.message ?? t("users.toast.deleteFailed")),
  });

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const uErr = validateUsername(form.username, t);
    if (uErr) return setFormErr(uErr);
    const pErr = validatePassword(form.password, t);
    if (pErr) return setFormErr(pErr);
    setFormErr(null);
    m.mutate(form);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("users.title")} subtitle={t("users.subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.new")}</CardTitle>
          <CardDescription>{t("users.newDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("auth.username")}</Label>
              <Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("auth.password")}</Label>
              <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("auth.displayName")}</Label>
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.role")}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r, t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between gap-3 flex-wrap">
              {formErr ? <span className="text-xs text-destructive">{formErr}</span> : <span />}
              <Button type="submit" disabled={m.isPending} className="ml-auto">
                <UserPlus className="h-4 w-4" /> {t("users.create")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.all")}</CardTitle>
          <CardDescription>{t("users.totalCount", { n: q.data?.length ?? 0 })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground p-6">{t("common.loading")}</div>
          ) : q.error ? (
            <div className="p-6"><ErrorBox error={q.error} /></div>
          ) : q.data && q.data.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">{t("auth.username")}</TableHead>
                    <TableHead>{t("auth.displayName")}</TableHead>
                    <TableHead>{t("common.role")}</TableHead>
                    <TableHead>{t("common.created")}</TableHead>
                    <TableHead className="w-24 pr-6 text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono pl-6 break-all">{u.username}</TableCell>
                      <TableCell>{u.display_name}</TableCell>
                      <TableCell><Badge variant="secondary">{roleLabel(u.role, t)}</Badge></TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="inline-flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title={t("common.edit")}
                            onClick={() => setEditing(u)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {u.username !== "admin" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => { if (confirm(t("users.confirmDelete", { name: u.username }))) dm.mutate(u.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-6"><EmptyState message={t("users.empty")} /></div>
          )}
        </CardContent>
      </Card>

      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["users"] }); }}
      />
    </div>
  );
}

function EditUserDialog({ user, onClose, onSaved }: { user: any | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const update = useServerFn(adminUpdateUserFn);
  const [err, setErr] = useState<string | null>(null);
  const open = !!user;

  const m = useMutation({
    mutationFn: (d: any) => update({ data: d }),
    onSuccess: () => { toast.success(t("users.toast.updated")); onSaved(); },
    onError: (e: any) => { const msg = e?.message ?? t("users.toast.failed"); setErr(msg); toast.error(msg); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setErr(null); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.editTitle")}</DialogTitle>
          <DialogDescription>{t("users.editDesc")}</DialogDescription>
        </DialogHeader>
        {user && (
          <EditUserForm
            key={user.id}
            user={user}
            err={err}
            setErr={setErr}
            pending={m.isPending}
            onSubmit={(data) => m.mutate({ id: user.id, ...data })}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditUserForm({
  user, err, setErr, pending, onSubmit, onCancel,
}: {
  user: any;
  err: string | null;
  setErr: (v: string | null) => void;
  pending: boolean;
  onSubmit: (data: { username?: string; displayName?: string; role?: Role; password?: string }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [password, setPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (username !== user.username) {
      const ue = validateUsername(username, t);
      if (ue) return setErr(ue);
    }
    if (password) {
      const pe = validatePassword(password, t);
      if (pe) return setErr(pe);
    }
    setErr(null);
    onSubmit({
      username: username !== user.username ? username : undefined,
      displayName: displayName !== (user.display_name ?? "") ? displayName : undefined,
      role: role !== user.role ? role : undefined,
      password: password || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>{t("auth.username")}</Label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("auth.displayName")}</Label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("common.role")}</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r, t)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t("users.newPassword")}</Label>
        <Input type="password" placeholder={t("users.passwordKeep")}
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={pending}>{t("common.saveChanges")}</Button>
      </DialogFooter>
    </form>
  );
}
