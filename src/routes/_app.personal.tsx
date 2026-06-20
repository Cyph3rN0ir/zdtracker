import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPersonalProfileFn, listPersonalProfilesFn } from "@/lib/zt.functions";
import { PageHeader, ErrorBox, EmptyState } from "./_app.index";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Plus, User } from "lucide-react";

export const Route = createFileRoute("/_app/personal")({
  component: PersonalList,
  head: () => ({ meta: [{ title: "Personal — ZeroSync" }] }),
});

function PersonalList() {
  const list = useServerFn(listPersonalProfilesFn);
  const create = useServerFn(createPersonalProfileFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["personal"], queryFn: () => list() });
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: () => create({ data: { name: name.trim() } }),
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["personal"] }); },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Personal profiles" subtitle="Track your own money, separate from any business." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New profile</CardTitle>
            <CardDescription>One per ledger you want to keep.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) m.mutate(); }} className="flex flex-col gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Profile name" />
              <Button type="submit" disabled={m.isPending || !name.trim()}>
                <Plus className="h-4 w-4" /> Create
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">All profiles</CardTitle>
              <CardDescription>{q.data?.length ?? 0} total</CardDescription>
            </div>
            <User className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {q.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : q.error ? (
              <ErrorBox error={q.error} />
            ) : q.data && q.data.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-24 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/personal/$id" params={{ id: p.id }}>Open <ArrowRight className="h-3 w-3" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="No personal profiles yet." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
