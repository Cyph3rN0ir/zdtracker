import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getNoteFn, upsertNoteFn, deleteNoteFn, togglePinNoteFn } from "@/lib/notebook.functions";
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
  const qc = useQueryClient();

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
  const loaded = useRef(false);

  useEffect(() => {
    if (q.data && !loaded.current) {
      setTitle(q.data.title || "");
      setBody(q.data.body_md || "");
      loaded.current = true;
    }
  }, [q.data]);

  const mSave = useMutation({
    mutationFn: () => upsert({ data: { id: noteId, title, body_md: body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebook", "notes"] }),
  });

  // Debounced autosave
  useEffect(() => {
    if (!loaded.current) return;
    const h = setTimeout(() => mSave.mutate(), 1500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  const mDelete = useMutation({
    mutationFn: () => remove({ data: { id: noteId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notebook", "notes"] });
      nav({ to: "/notebook/lists" });
    },
  });

  const mPin = useMutation({
    mutationFn: (pinned: boolean) => pin({ data: { id: noteId, pinned } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notebook", "notes"] }),
  });

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (q.isError) return <div className="text-sm text-destructive">Failed to load note.</div>;

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
          onBlur={() => mSave.mutate()}
          placeholder="Note title"
          className="h-10 min-w-0 text-base font-semibold border-0 shadow-none focus-visible:ring-0 px-2"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            aria-label={preview ? "Edit" : "Preview"}
            className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          >
            {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => mPin.mutate(!q.data?.pinned)}
            aria-label={q.data?.pinned ? "Unpin" : "Pin"}
            className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          >
            {q.data?.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this note?")) mDelete.mutate();
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
          onBlur={() => mSave.mutate()}
          placeholder="Start writing… Use - [ ] for todos, # for headings, **bold**, *italic*."
          className="min-h-[60dvh] w-full resize-none rounded-xl border border-border bg-card p-4 text-sm leading-relaxed font-mono focus:outline-none focus:border-foreground/30"
        />
      )}

      <div className="sticky bottom-0 -mx-1 sm:mx-0 flex items-center justify-between gap-2 border-t border-border/60 bg-background/85 backdrop-blur px-2 py-1.5 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{mSave.isPending ? "Saving…" : "Autosaved"}</span>
        <Button size="sm" variant="ghost" onClick={() => mSave.mutate()} className="h-7 px-2 text-[11px]">
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
