import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPersonalProfileFn, listPersonalProfilesFn } from "@/lib/zt.functions";
import { PageHeader, ErrorBox, EmptyState } from "./_app.index";

export const Route = createFileRoute("/_app/personal")({
  component: PersonalList,
  head: () => ({ meta: [{ title: "Personal — ZeroTrack" }] }),
});

function PersonalList() {
  const list = useServerFn(listPersonalProfilesFn);
  const create = useServerFn(createPersonalProfileFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["personal"], queryFn: () => list() });
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: () => create({ data: { name: name.trim() } }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["personal"] });
    },
  });
  return (
    <div>
      <PageHeader title="Personal profiles" subtitle="Track your own money, separate from any business." />
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
          placeholder="New profile name"
          className="border border-input px-3 py-1.5 text-sm flex-1 max-w-xs outline-none focus:border-foreground"
        />
        <button className="bg-primary text-primary-foreground px-3 py-1.5 text-sm disabled:opacity-50" disabled={m.isPending}>
          Create
        </button>
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
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((p: any) => (
                <tr key={p.id} className="border-t border-border hover:bg-accent/50">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to="/personal/$id" params={{ id: p.id }} className="text-xs underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No personal profiles yet." />
      )}
    </div>
  );
}
