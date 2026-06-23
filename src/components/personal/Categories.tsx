import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  upsertPersonalCategoryFn, deletePersonalCategoryFn,
} from "@/lib/zt.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

type Cat = { id: string; name: string; kind: "income" | "expense"; color: string; icon: string; archived: boolean };

export function PersonalCategories({ profileId, categories }: { profileId: string; categories: Cat[] }) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertPersonalCategoryFn);
  const del = useServerFn(deletePersonalCategoryFn);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [color, setColor] = useState("#6366f1");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["personal-cats", profileId] });

  const add = useMutation({
    mutationFn: () => upsert({ data: { profileId, name, kind, color, icon: "circle", archived: false } }),
    onSuccess: () => { setName(""); toast.success("Category added"); invalidate(); },
  });
  const dm = useMutation({
    mutationFn: (id: string) => del({ data: { id, profileId } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
  });
  const updColor = useMutation({
    mutationFn: (c: Cat) => upsert({ data: { profileId, id: c.id, name: c.name, kind: c.kind, color: c.color, icon: c.icon, archived: c.archived } }),
    onSuccess: () => invalidate(),
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
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
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
                {categories.filter((c) => c.kind === g.kind).map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <input type="color" value={c.color} onChange={(e) => updColor.mutate({ ...c, color: e.target.value })} className="h-5 w-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                      <span>{c.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => dm.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
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
