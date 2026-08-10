import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getNoteFn, upsertNoteFn, deleteNoteFn, togglePinNoteFn } from "@/lib/notebook.functions";
import { OFFLINE_OPS } from "@/lib/offline-operations";
import { removeRow, updateRows, useOfflineMutation } from "@/lib/use-offline-mutation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Pin, PinOff, Trash2, Eye, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/notebook/notes/$noteId")({
  component: NoteEditor,
  head: () => ({ meta: [{ title: "Note — Notebook — ZeroSync" }] }),
});

function NoteEditor() {
  const { noteId } = Route.useParams();
  const nav = useNavigate();

  const getNote = useServerFn(getNoteFn);
  const upsert = useServerFn(upsertNoteFn);
  const remove = useServerFn(deleteNoteFn);
  const pin = useServerFn(togglePinNoteFn);

  const q = useQuery({
    queryKey: ["notebook", "note", noteId],
    queryFn: () => getNote({ data: { id: noteId } }),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const loaded = useRef(false);
  const latestDraft = useRef({ title: "", body_md: "" });
  const draftKey = `zs:note-draft:${noteId}`;

  useEffect(() => {
    if (loaded.current) return;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null") as {
        title?: string;
        body_md?: string;
      } | null;
      if (draft) {
        setTitle(draft.title ?? "");
        setBody(draft.body_md ?? "");
        latestDraft.current = { title: draft.title ?? "", body_md: draft.body_md ?? "" };
        setHasDraft(true);
        loaded.current = true;
        return;
      }
    } catch {}
    if (q.data) {
      setTitle(q.data.title || "");
      setBody(q.data.body_md || "");
      latestDraft.current = { title: q.data.title || "", body_md: q.data.body_md || "" };
      loaded.current = true;
    }
  }, [draftKey, q.data]);

  const mSave = useOfflineMutation<{ id: string; title: string; body_md: string }>({
    operation: OFFLINE_OPS.NOTE_UPSERT,
    mutationFn: (data) => upsert({ data }),
    affectedKeys: [["notebook", "note", noteId], ["notebook", "notes"]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: (client, data) => {
      const updatedAt = new Date().toISOString();
      client.setQueryData<any>(["notebook", "note", noteId], (row: any) => ({
        ...row, id: noteId, title: data.title, body_md: data.body_md, updated_at: updatedAt,
      }));
      client.setQueriesData<any[]>({ queryKey: ["notebook", "notes"] }, (rows) =>
        updateRows(rows, data.id, (row) => ({ ...row, title: data.title, body_md: data.body_md, updated_at: updatedAt })),
      );
    },
    onSuccess: (_result, data) => {
      if (latestDraft.current.title === data.title && latestDraft.current.body_md === data.body_md) {
        try { localStorage.removeItem(draftKey); } catch {}
        setHasDraft(false);
      }
    },
  });

  // Debounced autosave
  useEffect(() => {
    if (!loaded.current) return;
    const draft = { title, body_md: body };
    latestDraft.current = draft;
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setHasDraft(true);
    } catch {}
    const h = setTimeout(() => mSave.mutate({ id: noteId, title, body_md: body }), 1500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, draftKey, noteId]);

  const mDelete = useOfflineMutation<{ id: string }>({
    operation: OFFLINE_OPS.NOTE_DELETE,
    mutationFn: (data) => remove({ data }),
    affectedKeys: [["notebook", "note", noteId], ["notebook", "notes"]],
    optimisticUpdate: (client, data) => {
      client.setQueriesData<any[]>({ queryKey: ["notebook", "notes"] }, (rows) => removeRow(rows, data.id));
      client.removeQueries({ queryKey: ["notebook", "note", data.id], exact: true });
    },
    onSuccess: () => {
      try { localStorage.removeItem(draftKey); } catch {}
      nav({ to: "/notebook/lists" });
    },
  });

  const mPin = useOfflineMutation<{ id: string; pinned: boolean }>({
    operation: OFFLINE_OPS.NOTE_PIN,
    mutationFn: (data) => pin({ data }),
    affectedKeys: [["notebook", "note", noteId], ["notebook", "notes"]],
    coalesceKey: (data) => data.id,
    optimisticUpdate: (client, data) => {
      client.setQueryData<any>(["notebook", "note", noteId], (row: any) => ({ ...row, pinned: data.pinned }));
      client.setQueriesData<any[]>({ queryKey: ["notebook", "notes"] }, (rows) =>
        updateRows(rows, data.id, (row) => ({ ...row, pinned: data.pinned })),
      );
    },
  });

  if (q.isLoading && !hasDraft) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (q.isError && !q.data && !q.isFetching && !hasDraft)
    return <div className="text-sm text-destructive">Failed to load note.</div>;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
        {q.data?.list_id ? (
          <Link
            to="/notebook/lists/$listId"
            params={{ listId: q.data.list_id }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md hover:bg-accent hover:text-accent-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : (
          <Link
            to="/notebook/lists"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md hover:bg-accent hover:text-accent-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        )}

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => mSave.mutate({ id: noteId, title, body_md: body })}
          placeholder="Note title"
          className="h-10 min-w-0 text-base font-semibold border-0 shadow-none focus-visible:ring-0 px-2"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            aria-label={preview ? "Edit" : "Preview"}
            className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => mPin.mutate({ id: noteId, pinned: !q.data?.pinned })}
            aria-label={q.data?.pinned ? "Unpin" : "Pin"}
            className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {q.data?.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this note?")) mDelete.mutate({ id: noteId });
            }}
            aria-label="Delete"
            className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {preview ? (
        <Card>
          <CardContent className="py-4">
            <div className="mx-auto max-w-prose">
              <MarkdownView md={body} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => mSave.mutate({ id: noteId, title, body_md: body })}
          placeholder="Start writing… Use - [ ] for todos, # for headings, **bold**, *italic*."
          className="min-h-[60dvh] w-full resize-none rounded-xl border border-border bg-card p-4 text-sm leading-relaxed font-mono focus:outline-none focus:border-foreground/30"
        />
      )}

      <div className="sticky bottom-0 -mx-1 sm:mx-0 flex items-center justify-between gap-2 border-t border-border/60 bg-background/85 backdrop-blur px-2 py-1.5 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{mSave.isPending ? "Saving…" : mSave.data?.queued ? "Saved offline" : "Autosaved"}</span>
        <Button size="sm" variant="ghost" onClick={() => mSave.mutate({ id: noteId, title, body_md: body })} className="h-7 px-2 text-[11px]">
          Save now
        </Button>
      </div>
    </div>
  );
}

/** Minimal markdown renderer — headings, bold/italic, lists, checkboxes, code spans. */
function MarkdownView({ md }: { md: string }) {
  const lines = md.split("\n");
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none space-y-1">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (line.startsWith("### ")) return <h3 key={i}>{inline(line.slice(4))}</h3>;
        if (line.startsWith("## ")) return <h2 key={i}>{inline(line.slice(3))}</h2>;
        if (line.startsWith("# ")) return <h1 key={i}>{inline(line.slice(2))}</h1>;
        const cb = line.match(/^[-*] \[( |x|X)\] (.*)$/);
        if (cb) {
          const checked = cb[1].toLowerCase() === "x";
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={checked} readOnly className="mt-1" />
              <span className={checked ? "line-through text-muted-foreground" : ""}>{inline(cb[2])}</span>
            </div>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <li key={i} className="ml-4 list-disc">{inline(line.slice(2))}</li>;
        }
        if (!line) return <div key={i} className="h-2" />;
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

function inline(s: string): React.ReactNode {
  // very lightweight: **bold**, *italic*, `code`
  const parts: React.ReactNode[] = [];
  const rx = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = rx.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) parts.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    else parts.push(<code key={i++} className="rounded bg-muted px-1 py-0.5 text-[12px]">{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
