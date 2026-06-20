import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addMemberFn, listMembersFn, removeMemberFn } from "@/lib/zt.functions";
import { listUsersFn } from "@/lib/auth.functions";
import { ErrorBox } from "./_app.index";

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
  const m = useMutation({
    mutationFn: () => add({ data: { businessId: id, userId: sel.userId, role: sel.role } }),
    onSuccess: () => {
      setSel({ userId: "", role: sel.role });
      qc.invalidateQueries({ queryKey: ["members", id] });
    },
  });
  const dm = useMutation({
    mutationFn: (mid: string) => remove({ data: { id: mid } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", id] }),
  });

  const grouped: Record<string, any[]> = { owner: [], investor: [], member: [] };
  (q.data ?? []).forEach((m: any) => grouped[m.role_in_business]?.push(m));

  return (
    <div>
      {me.role === "admin" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (sel.userId) m.mutate();
          }}
          className="flex gap-2 items-end mb-6 border border-border p-3"
        >
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">User</div>
            <select
              value={sel.userId}
              onChange={(e) => setSel({ ...sel, userId: e.target.value })}
              className="w-full border border-input px-2 py-1.5 text-sm bg-background"
              required
            >
              <option value="">Select a user…</option>
              {(users.data ?? []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.username} {u.display_name ? `— ${u.display_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Role</div>
            <select
              value={sel.role}
              onChange={(e) => setSel({ ...sel, role: e.target.value as any })}
              className="border border-input px-2 py-1.5 text-sm bg-background"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button className="bg-primary text-primary-foreground px-3 py-1.5 text-sm" disabled={m.isPending}>
            Add
          </button>
        </form>
      )}

      {q.error && <ErrorBox error={q.error} />}
      <div className="grid grid-cols-3 gap-4">
        {ROLES.map((r) => (
          <div key={r} className="border border-border">
            <div className="bg-muted px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">{r}s</div>
            {grouped[r].length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">None.</div>
            ) : (
              <ul className="divide-y divide-border">
                {grouped[r].map((m) => (
                  <li key={m.id} className="px-3 py-2 flex items-center justify-between text-sm">
                    <span>
                      {m.user?.username ?? "(deleted)"}{" "}
                      {m.user?.display_name && (
                        <span className="text-muted-foreground">— {m.user.display_name}</span>
                      )}
                    </span>
                    {me.role === "admin" && (
                      <button onClick={() => dm.mutate(m.id)} className="text-xs text-destructive hover:underline">
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
