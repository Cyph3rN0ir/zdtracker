import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  upsertPersonalCategoryFn, deletePersonalCategoryFn,
} from "@/lib/zt.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { createOfflineId } from "@/lib/offline-queue";
import { OFFLINE_OPS } from "@/lib/offline-operations";
import { removeRow, updateRows, useOfflineMutation } from "@/lib/use-offline-mutation";

type Cat = { id: string; name: string; kind: "income" | "expense"; color: string; icon: string; archived: boolean };

export function PersonalCategories({ profileId, categories }: { profileId: string; categories: Cat[] }) {
  const upsert = useServerFn(upsertPersonalCategoryFn);
  const del = useServerFn(deletePersonalCategoryFn);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [color, setColor] = useState("#6366f1");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<"income" | "expense">("expense");

  type CatInput = { clientId?: string; id?: string; profileId: string; name: string; kind: "income" | "expense"; color: string; icon: string; archived: boolean };
  const updateCache = (client: QueryClient, data: CatInput & { id: string }) =>
    client.setQueryData<Cat[]>(["personal-cats", profileId], (rows: Cat[] | undefined) =>
      updateRows(rows, data.id, (row) => ({ ...row, name: data.name, kind: data.kind, color: data.color, icon: data.icon, archived: data.archived })),
    );

  const add = useOfflineMutation<CatInput>({
    operation: OFFLINE_OPS.PERSONAL_CATEGORY_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["personal-cats", profileId]],
    optimisticUpdate: (client, data) => client.setQueryData<Cat[]>(["personal-cats", profileId], (rows) => [
      ...(rows ?? []),
      { id: data.clientId!, name: data.name, kind: data.kind, color: data.color, icon: data.icon, archived: data.archived },
    ]),
    onSuccess: (result) => { setName(""); toast.success(result.queued ? "Category saved offline" : "Category added"); },
  });
  const dm = useOfflineMutation<{ id: string; profileId: string }>({
    operation: OFFLINE_OPS.PERSONAL_CATEGORY_DELETE,
    mutationFn: (data) => del({ data }),
    affectedKeys: [["personal-cats", profileId]],
    optimisticUpdate: (client, data) => client.setQueryData<Cat[]>(["personal-cats", profileId], (rows) => removeRow(rows, data.id)),
    onSuccess: (result) => toast.success(result.queued ? "Deletion saved offline" : "Deleted"),
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });
  const updMut = useOfflineMutation<CatInput & { id: string }>({
    operation: OFFLINE_OPS.PERSONAL_CATEGORY_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["personal-cats", profileId]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: updateCache,
    onSuccess: (result) => { setEditingId(null); toast.success(result.queued ? "Update saved offline" : "Updated"); },
  });
  const updColor = useOfflineMutation<CatInput & { id: string }>({
    operation: OFFLINE_OPS.PERSONAL_CATEGORY_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["personal-cats", profileId]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: updateCache,
  });

  const groups = [
    { kind: "expense" as const, title: "Expense categories" },
    { kind: "income" as const, title: "Income categories" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add category</CardTitle><CardDescription>Used to tag transactions and budgets.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate({ clientId: createOfflineId(), profileId, name, kind, color, icon: "circle", archived: false }); }} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-20 p-1" />
            </div>
            <Button type="submit" disabled={add.isPending}><Plus className="h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((g) => (
          <Card key={g.kind}>
            <CardHeader><CardTitle className="text-base">{g.title}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {categories.filter((c) => c.kind === g.kind).map((c) => {
                  const editing = editingId === c.id;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <input type="color" value={c.color} onChange={(e) => updColor.mutate({ ...c, profileId, color: e.target.value })} className="h-5 w-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0" />
                        {editing ? (
                          <>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 flex-1 min-w-0" autoFocus />
                            <Select value={editKind} onValueChange={(v) => setEditKind(v as any)}>
                              <SelectTrigger className="h-7 w-24 shrink-0"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="expense">Expense</SelectItem>
                                <SelectItem value="income">Income</SelectItem>
                              </SelectContent>
                            </Select>
                          </>
                        ) : (
                          <span className="truncate">{c.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {editing ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updMut.mutate({ ...c, profileId, name: editName.trim() || c.name, kind: editKind })}><Check className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                              onClick={() => { setEditingId(c.id); setEditName(c.name); setEditKind(c.kind); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate({ id: c.id, profileId })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {categories.filter((c) => c.kind === g.kind).length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">None.</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
