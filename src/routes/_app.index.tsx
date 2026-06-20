import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createBusinessFn, listBusinessesFn } from "@/lib/zt.functions";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — ZeroTrack" }] }),
});

function Dashboard() {
  const { me } = Route.useRouteContext() as any;
  const list = useServerFn(listBusinessesFn);
  const create = useServerFn(createBusinessFn);
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

  return (
    <div>
      <PageHeader title="Businesses" subtitle="All businesses you have access to." />

      {me.role === "admin" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) m.mutate();
          }}
          className="flex gap-2 mb-6"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New business name"
            className="border border-input px-3 py-1.5 text-sm flex-1 max-w-xs outline-none focus:border-foreground"
          />
          <button
            type="submit"
            disabled={m.isPending || !name.trim()}
            className="bg-primary text-primary-foreground px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Create
          </button>
        </form>
      )}

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : q.data && q.data.length > 0 ? (
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium w-32"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((b: any) => (
                <tr key={b.id} className="border-t border-border hover:bg-accent/50">
                  <td className="px-3 py-2">{b.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link to="/businesses/$id" params={{ id: b.id }} className="text-xs underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message={me.role === "admin" ? "No businesses yet. Create one above." : "No businesses assigned to you yet."} />
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between border-b border-border pb-4 mb-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{message}</div>;
}

export function ErrorBox({ error }: { error: any }) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <div className="font-medium text-destructive">Error</div>
      <div className="text-destructive/90 mt-1">{error?.message ?? String(error)}</div>
      <div className="text-xs text-muted-foreground mt-2">
        If this mentions a missing table, run <code>SUPABASE_SETUP.sql</code> in your Supabase SQL editor.
      </div>
    </div>
  );
}
