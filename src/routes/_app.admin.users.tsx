import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminCreateUserFn, adminDeleteUserFn, listUsersFn } from "@/lib/auth.functions";
import { PageHeader, ErrorBox, EmptyState } from "./_app.index";

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
    <div>
      <PageHeader title="Users" subtitle="Create accounts. Share credentials privately." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(form);
        }}
        className="grid grid-cols-2 gap-3 max-w-2xl border border-border p-4 mb-6"
      >
        <Field label="Username">
          <input
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full border border-input px-3 py-1.5 text-sm outline-none focus:border-foreground"
          />
        </Field>
        <Field label="Password">
          <input
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-input px-3 py-1.5 text-sm outline-none focus:border-foreground"
          />
        </Field>
        <Field label="Display name">
          <input
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="w-full border border-input px-3 py-1.5 text-sm outline-none focus:border-foreground"
          />
        </Field>
        <Field label="Role">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as any })}
            className="w-full border border-input px-3 py-1.5 text-sm bg-background"
          >
            <option value="admin">admin</option>
            <option value="owner">owner</option>
            <option value="investor">investor</option>
            <option value="member">member</option>
          </select>
        </Field>
        <div className="col-span-2 flex items-center justify-between">
          {err && <span className="text-xs text-destructive">{err}</span>}
          <button
            type="submit"
            disabled={m.isPending}
            className="bg-primary text-primary-foreground px-4 py-1.5 text-sm disabled:opacity-50 ml-auto"
          >
            Create user
          </button>
        </div>
      </form>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : q.data && q.data.length ? (
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Username</th>
                <th className="px-3 py-2 font-medium">Display name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((u: any) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{u.username}</td>
                  <td className="px-3 py-2">{u.display_name}</td>
                  <td className="px-3 py-2 text-xs uppercase">{u.role}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">
                    {u.username !== "admin" && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${u.username}?`)) dm.mutate(u.id);
                        }}
                        className="text-xs text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No users yet." />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
