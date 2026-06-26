import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getConversationFn,
  listMessagesFn,
  sendMessageFn,
  markReadFn,
} from "@/lib/chat.functions";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CornerUpLeft, Send, Users as UsersIcon, X } from "lucide-react";

export const Route = createFileRoute("/_app/chat/$conversationId")({
  component: ThreadView,
});

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ThreadView() {
  const { conversationId } = Route.useParams();
  const getConv = useServerFn(getConversationFn);
  const listMsgs = useServerFn(listMessagesFn);
  const sendMsg = useServerFn(sendMessageFn);
  const markRead = useServerFn(markReadFn);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const convQ = useQuery({
    queryKey: ["chat", "conv", conversationId],
    queryFn: () => getConv({ data: { conversationId } }),
  });
  const msgsQ = useQuery({
    queryKey: ["chat", "messages", conversationId],
    queryFn: () => listMsgs({ data: { conversationId } }),
    refetchInterval: 8000,
  });

  // Realtime: subscribe to broadcast on this conversation
  useEffect(() => {
    const supa = getSupabaseBrowser();
    const ch = supa.channel(`conv:${conversationId}`);
    ch.on("broadcast", { event: "ping" }, () => {
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    }).subscribe();
    return () => { supa.removeChannel(ch); };
  }, [conversationId, qc]);

  // Mark read when messages load / on new ones
  useEffect(() => {
    if (msgsQ.data && msgsQ.data.length > 0) {
      markRead({ data: { conversationId } }).then(() => {
        qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
        qc.invalidateQueries({ queryKey: ["chat", "unread-total"] });
      }).catch(() => {});
    }
  }, [msgsQ.data?.[msgsQ.data.length - 1]?.id, conversationId]);

  // Auto-scroll on new messages
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMsgId = msgsQ.data?.[msgsQ.data.length - 1]?.id;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastMsgId, conversationId]);

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; body: string } | null>(null);
  const send = useMutation({
    mutationFn: (input: { body: string; replyToId: string | null }) =>
      sendMsg({ data: { conversationId, body: input.body, replyToId: input.replyToId } }),
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });

  function submit() {
    const text = body.trim();
    if (!text || send.isPending) return;
    send.mutate({ body: text, replyToId: replyTo?.id ?? null });
  }

  const conv = convQ.data;
  const isGroup = conv?.kind === "group";

  // Group messages by day for separators
  const grouped = useMemo(() => {
    const out: Array<{ day: string; items: NonNullable<typeof msgsQ.data> }> = [];
    for (const m of msgsQ.data ?? []) {
      const day = formatDay(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [msgsQ.data]);

  function scrollToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1500);
    }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col h-full w-full bg-background">

      <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => navigate({ to: "/chat" })}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{conv?.title ?? "Loading…"}</div>
          <div className="text-xs text-muted-foreground truncate">
            {isGroup ? (
              <>{conv?.businessName} · {conv?.members.length ?? 0} members</>
            ) : (
              conv?.businessName
            )}
          </div>
        </div>
        {isGroup && <UsersIcon className="h-4 w-4 text-muted-foreground" />}
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {msgsQ.isLoading ? (
          <div className="text-sm text-muted-foreground text-center">Loading…</div>
        ) : (msgsQ.data?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground text-center pt-8">
            No messages yet. Say hi!
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.day} className="space-y-2">
              <div className="flex justify-center">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {g.day}
                </span>
              </div>
              {g.items.map((m) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  isGroup={!!isGroup}
                  onReply={() => setReplyTo({ id: m.id, senderName: m.senderName, body: m.body })}
                  onJumpReply={(id) => scrollToMessage(id)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
            <CornerUpLeft className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-primary">Replying to {replyTo.senderName}</div>
              <div className="text-xs text-muted-foreground truncate">{replyTo.body}</div>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cancel reply"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Type a message…"
            rows={1}
            className="min-h-10 h-10 max-h-32 resize-none py-2 leading-6 text-base sm:text-sm flex-1"
          />
          <Button
            onClick={submit}
            disabled={!body.trim() || send.isPending}
            size="icon"
            aria-label="Send"
            className="h-10 w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  isGroup,
  onReply,
  onJumpReply,
}: {
  m: {
    id: string;
    senderId: string | null;
    senderName: string;
    body: string;
    createdAt: string;
    replyTo: { id: string; body: string; senderName: string } | null;
    mine: boolean;
  };
  isGroup: boolean;
  onReply: () => void;
  onJumpReply: (id: string) => void;
}) {
  return (
    <div id={`msg-${m.id}`} className={`flex ${m.mine ? "justify-end" : "justify-start"} group`}>
      <div className={`max-w-[80%] sm:max-w-[70%] ${m.mine ? "items-end" : "items-start"} flex flex-col`}>
        {isGroup && !m.mine && (
          <div className="text-[11px] font-medium text-primary mb-0.5 px-1">{m.senderName}</div>
        )}
        <div className="flex items-end gap-1">
          {m.mine && (
            <button
              type="button"
              onClick={onReply}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1"
              aria-label="Reply"
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <div
            className={`rounded-2xl px-3 py-2 text-sm break-words ${
              m.mine
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm"
            }`}
          >
            {m.replyTo && (
              <button
                type="button"
                onClick={() => onJumpReply(m.replyTo!.id)}
                className={`block w-full text-left mb-1.5 rounded border-l-2 px-2 py-1 text-xs ${
                  m.mine
                    ? "border-primary-foreground/50 bg-primary-foreground/10"
                    : "border-primary/60 bg-background/60"
                }`}
              >
                <div className="font-medium opacity-90 truncate">{m.replyTo.senderName}</div>
                <div className="opacity-80 truncate">{m.replyTo.body}</div>
              </button>
            )}
            <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</div>
            <div className={`text-[10px] mt-0.5 ${m.mine ? "text-primary-foreground/70" : "text-muted-foreground"} text-right`}>
              {formatTime(m.createdAt)}
            </div>
          </div>
          {!m.mine && (
            <button
              type="button"
              onClick={onReply}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1"
              aria-label="Reply"
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
