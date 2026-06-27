import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getConversationFn,
  listMessagesFn,
  sendMessageFn,
  markReadFn,
} from "@/lib/chat.functions";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowDown,
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  Send,
  Users as UsersIcon,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_app/chat/$conversationId")({
  component: ThreadView,
});

type Msg = {
  id: string;
  senderId: string | null;
  senderName: string;
  body: string;
  createdAt: string;
  replyTo: { id: string; body: string; senderName: string } | null;
  mine: boolean;
  readers: Array<{ id: string; name: string }>;
  readByAll: boolean;
  otherMembersCount: number;
  pending?: boolean;
};

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
  const router = useRouter();

  const convQ = useQuery({
    queryKey: ["chat", "conv", conversationId],
    queryFn: () => getConv({ data: { conversationId } }),
  });
  const msgsQ = useQuery<Msg[]>({
    queryKey: ["chat", "messages", conversationId],
    queryFn: () => listMsgs({ data: { conversationId } }) as Promise<Msg[]>,
    refetchInterval: 30000,
  });

  // ----- Realtime channel -----
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null>(null);
  const myIdRef = useRef<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; at: number }>>({});

  useEffect(() => {
    const supa = getSupabaseBrowser();
    const ch = supa.channel(`conv:${conversationId}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;
    ch.on("broadcast", { event: "ping" }, () => {
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    });
    ch.on("broadcast", { event: "typing" }, (payload: any) => {
      const { userId, name, typing } = payload.payload ?? {};
      if (!userId || userId === myIdRef.current) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing) next[userId] = { name: name ?? "Someone", at: Date.now() };
        else delete next[userId];
        return next;
      });
    });
    ch.subscribe();
    supa.auth.getUser().then(({ data }) => { myIdRef.current = data.user?.id ?? null; });
    return () => { channelRef.current = null; supa.removeChannel(ch); };
  }, [conversationId, qc]);

  // Expire stale typing indicators
  useEffect(() => {
    const t = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        let changed = false;
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.at < 4000) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  // ----- Smart scroll -----
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isAtBottomRef.current = true;
    setShowJumpToBottom(false);
    setNewCount(0);
  }, []);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < 80;
    isAtBottomRef.current = atBottom;
    setShowJumpToBottom(!atBottom);
    if (atBottom) setNewCount(0);
  }

  const lastMsg = msgsQ.data?.[msgsQ.data.length - 1];
  const lastMsgId = lastMsg?.id;
  const prevLastIdRef = useRef<string | undefined>(undefined);

  // Initial / thread-switch scroll
  useEffect(() => {
    prevLastIdRef.current = undefined;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [conversationId, scrollToBottom]);

  // Per-message-change scroll logic
  useEffect(() => {
    if (!lastMsgId || lastMsgId === prevLastIdRef.current) return;
    const wasNew = prevLastIdRef.current !== undefined;
    prevLastIdRef.current = lastMsgId;
    if (!wasNew) {
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }
    if (lastMsg?.mine || isAtBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } else {
      setNewCount((n) => n + 1);
      setShowJumpToBottom(true);
    }
  }, [lastMsgId, lastMsg?.mine, scrollToBottom]);

  // ----- Mark-read (debounced, visibility-gated) -----
  const markReadTimer = useRef<number | null>(null);
  const scheduleMarkRead = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (!isAtBottomRef.current) return;
    if (markReadTimer.current) window.clearTimeout(markReadTimer.current);
    markReadTimer.current = window.setTimeout(() => {
      markRead({ data: { conversationId } })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
          qc.invalidateQueries({ queryKey: ["chat", "unread-total"] });
        })
        .catch(() => {});
    }, 600);
  }, [conversationId, markRead, qc]);

  useEffect(() => {
    if ((msgsQ.data?.length ?? 0) > 0) scheduleMarkRead();
  }, [lastMsgId, conversationId, scheduleMarkRead, msgsQ.data?.length]);

  useEffect(() => {
    function onVis() { if (document.visibilityState === "visible") scheduleMarkRead(); }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [scheduleMarkRead]);

  // ----- Composer state + per-thread draft -----
  const draftKey = `zs:chat:draft:${conversationId}`;
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; body: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load draft on thread change
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      setBody(saved ?? "");
    } catch { setBody(""); }
    setReplyTo(null);
    // Focus textarea only on non-touch (desktop) devices to avoid auto-opening
    // the on-screen keyboard on mobile when entering a thread.
    if (typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [conversationId, draftKey]);

  // Persist draft
  useEffect(() => {
    try {
      if (body) sessionStorage.setItem(draftKey, body);
      else sessionStorage.removeItem(draftKey);
    } catch {}
  }, [body, draftKey]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 160; // ~6 rows
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, [body]);

  // ----- Send mutation with optimistic update -----
  const send = useMutation({
    mutationFn: (input: { body: string; replyToId: string | null; tempId: string }) =>
      sendMsg({ data: { conversationId, body: input.body, replyToId: input.replyToId } }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["chat", "messages", conversationId] });
      const prev = qc.getQueryData<Msg[]>(["chat", "messages", conversationId]) ?? [];
      const myId = myIdRef.current;
      const me = conv?.members.find((u) => u.id === myId);
      const replySource = input.replyToId ? prev.find((m) => m.id === input.replyToId) : null;
      const optimistic: Msg = {
        id: input.tempId,
        senderId: myId,
        senderName: me?.name ?? "You",
        body: input.body,
        createdAt: new Date().toISOString(),
        replyTo: replySource
          ? { id: replySource.id, body: replySource.body, senderName: replySource.senderName }
          : null,
        mine: true,
        readers: [],
        readByAll: false,
        otherMembersCount: Math.max((conv?.members.length ?? 1) - 1, 0),
        pending: true,
      };
      qc.setQueryData<Msg[]>(["chat", "messages", conversationId], [...prev, optimistic]);
      return { prev };
    },
    onError: (_err, input, ctx) => {
      if (ctx?.prev) qc.setQueryData(["chat", "messages", conversationId], ctx.prev);
      setBody(input.body);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });

  function submit() {
    const text = body.trim();
    if (!text || send.isPending) return;
    sendTyping(false);
    setBody("");
    setReplyTo(null);
    try { sessionStorage.removeItem(draftKey); } catch {}
    send.mutate({
      body: text,
      replyToId: replyTo?.id ?? null,
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    });
    // refocus only when textarea was already focused (don't pop keyboard on mobile after send)
    const wasFocused = document.activeElement === textareaRef.current;
    if (wasFocused) requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const conv = convQ.data;
  const isGroup = conv?.kind === "group";

  // ----- Typing broadcast helpers -----
  const typingStateRef = useRef<{ active: boolean; stopTimer: number | null }>({ active: false, stopTimer: null });
  function sendTyping(typing: boolean) {
    const ch = channelRef.current;
    const myId = myIdRef.current;
    if (!ch || !myId) return;
    const me = conv?.members.find((u) => u.id === myId);
    ch.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: myId, name: me?.name ?? "Someone", typing },
    });
  }
  function handleTypingChange(value: string) {
    setBody(value);
    const has = value.trim().length > 0;
    const s = typingStateRef.current;
    if (has && !s.active) {
      s.active = true;
      sendTyping(true);
    }
    if (s.stopTimer) window.clearTimeout(s.stopTimer);
    s.stopTimer = window.setTimeout(() => {
      if (s.active) {
        s.active = false;
        sendTyping(false);
      }
    }, 2500);
  }
  useEffect(() => () => {
    if (typingStateRef.current.active) sendTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ----- Group messages by day -----
  const grouped = useMemo(() => {
    const out: Array<{ day: string; items: Msg[] }> = [];
    for (const m of msgsQ.data ?? []) {
      const day = formatDay(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [msgsQ.data]);

  const scrollToMessage = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1500);
    }
  }, []);

  const handleReply = useCallback((m: Msg) => {
    setReplyTo({ id: m.id, senderName: m.senderName, body: m.body });
  }, []);

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else router.navigate({ to: "/chat" });
  }

  const charCount = body.length;
  const showCharCounter = charCount > 3500;

  return (
    <div className="flex flex-1 min-h-0 flex-col h-full w-full bg-background">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={handleBack}
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
        {isGroup && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="View members" className="shrink-0">
                <UsersIcon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] sm:w-80 p-0 flex flex-col">
              <SheetHeader className="px-4 py-3 border-b border-border text-left">
                <SheetTitle className="text-base">Members</SheetTitle>
                <SheetDescription className="text-xs">
                  {conv?.members.length ?? 0} in {conv?.title}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 min-h-0 overflow-y-auto py-2">
                {(conv?.members ?? []).map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium shrink-0">
                      {u.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                    </div>
                  </div>
                ))}
                {(conv?.members.length ?? 0) === 0 && (
                  <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No members
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </header>

      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="absolute inset-0 overflow-y-auto px-3 py-3 space-y-3 overscroll-contain"
        >
          {msgsQ.isLoading ? (
            <MessageSkeletons />
          ) : (msgsQ.data?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center text-center pt-16 px-6 text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Send className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium text-foreground">No messages yet</div>
              <div className="text-xs mt-1">Send the first message to start the conversation.</div>
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
                    onReply={handleReply}
                    onJumpReply={scrollToMessage}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {showJumpToBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-card border border-border shadow-md px-3 py-1.5 text-xs font-medium hover:bg-accent active:scale-95 transition"
            aria-label="Scroll to latest"
          >
            {newCount > 0 ? (
              <>
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1">
                  {newCount}
                </span>
                <span>new</span>
              </>
            ) : (
              <span>Latest</span>
            )}
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {Object.keys(typingUsers).length > 0 && (
        <div className="px-4 py-1 text-xs text-muted-foreground flex items-center gap-2 border-t border-border/50 bg-card/50">
          <span className="inline-flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
          </span>
          <span className="truncate">
            {(() => {
              const names = Object.values(typingUsers).map((u) => u.name);
              if (names.length === 1) return `${names[0]} is typing…`;
              if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
              return `${names.length} people are typing…`;
            })()}
          </span>
        </div>
      )}

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
            ref={textareaRef}
            value={body}
            onChange={(e) => handleTypingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Type a message…"
            rows={1}
            maxLength={4000}
            className="min-h-10 max-h-40 resize-none py-2 leading-6 text-base sm:text-sm flex-1 transition-all [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />
          <Button
            onClick={submit}
            disabled={!body.trim() || send.isPending}
            size="icon"
            aria-label="Send"
            className="h-10 w-10 shrink-0 active:scale-95 transition disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {showCharCounter && (
          <div className={`mt-1 text-[10px] text-right ${charCount >= 4000 ? "text-destructive" : "text-muted-foreground"}`}>
            {charCount}/4000
          </div>
        )}
      </div>
    </div>
  );
}

function MessageSkeletons() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
          <div
            className={`h-10 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? "w-40 rounded-bl-sm" : "w-32 rounded-br-sm"}`}
          />
        </div>
      ))}
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({
  m,
  isGroup,
  onReply,
  onJumpReply,
}: {
  m: Msg;
  isGroup: boolean;
  onReply: (m: Msg) => void;
  onJumpReply: (id: string) => void;
}) {
  const handleReply = () => onReply(m);
  return (
    <div id={`msg-${m.id}`} className={`flex ${m.mine ? "justify-end" : "justify-start"} group`}>
      <div className={`max-w-[80%] sm:max-w-[70%] ${m.mine ? "items-end" : "items-start"} flex flex-col`}>
        {isGroup && !m.mine && (
          <div className="text-[11px] font-medium text-primary mb-0.5 px-1">{m.senderName}</div>
        )}
        <div className="flex items-end gap-1">
          {m.mine && !m.pending && (
            <button
              type="button"
              onClick={handleReply}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1"
              aria-label="Reply"
            >
              <CornerUpLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <div
            className={`rounded-2xl px-3 py-2 text-sm break-words transition-opacity ${
              m.mine
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm"
            } ${m.pending ? "opacity-70" : ""}`}
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
            <div className={`flex items-center justify-end gap-1 text-[10px] tabular-nums mt-0.5 ${m.mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              <span>{formatTime(m.createdAt)}</span>
              {m.mine && (
                m.pending ? (
                  <Clock className="h-3 w-3 opacity-70" aria-label="Sending" />
                ) : m.otherMembersCount > 0 ? (
                  <span
                    className="inline-flex items-center"
                    title={
                      m.readByAll
                        ? isGroup
                            ? `Seen by ${m.readers.map((r) => r.name).join(", ")}`
                            : `Seen${m.readers[0] ? ` by ${m.readers[0].name}` : ""}`
                        : isGroup && m.readers.length > 0
                            ? `Seen by ${m.readers.length}/${m.otherMembersCount}`
                            : "Sent"
                    }
                    aria-label={m.readByAll ? "Seen" : "Sent"}
                  >
                    {m.readByAll ? (
                      <CheckCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Check className="h-3.5 w-3.5 opacity-70" />
                    )}
                    {isGroup && m.readers.length > 0 && !m.readByAll && (
                      <span className="ml-0.5">{m.readers.length}</span>
                    )}
                  </span>
                ) : null
              )}
            </div>
          </div>
          {!m.mine && (
            <button
              type="button"
              onClick={handleReply}
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
});
