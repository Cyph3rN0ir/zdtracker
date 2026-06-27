import { createFileRoute, Outlet, useParams, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // On mobile, when viewing a specific thread, hide list. Layout uses md:grid
  // for side-by-side, mobile uses block + conditional content via Outlet.
  const onThread = /^\/chat\/[^/]+/.test(pathname);
  return (
    <div className="fixed inset-x-0 bottom-0 top-[3.25rem] md:top-0 md:left-60 h-[calc(100dvh-3.25rem)] md:h-dvh bg-background z-30 flex md:grid md:grid-cols-[320px_1fr]">
      <aside
        className={`border-r border-border bg-card overflow-hidden h-full w-full md:w-auto ${onThread ? "hidden md:flex md:flex-col" : "flex flex-col"}`}
      >
        <ConversationListPanel />
      </aside>
      <section className={`overflow-hidden h-full min-h-0 w-full ${onThread ? "flex flex-col" : "hidden md:flex md:flex-col"}`}>
        <Outlet />
      </section>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { listConversationsFn } from "@/lib/chat.functions";
import { MessageSquare, Users as UsersIcon, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useQueryClient } from "@tanstack/react-query";

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dt = new Date(iso);
  const today = new Date();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (dt.toDateString() === yest.toDateString()) return "Yesterday";
  const days = Math.floor(h / 24);
  if (days < 7) return dt.toLocaleDateString(undefined, { weekday: "short" });
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function ConversationListPanel() {
  const list = useServerFn(listConversationsFn);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => list(),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Subscribe to a per-user channel for cross-conversation pings
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    const me = (() => {
      try { return JSON.parse(localStorage.getItem("zs:me:v1") || "null"); } catch { return null; }
    })();
    if (!me?.userId) return;
    userIdRef.current = me.userId;
    const supa = getSupabaseBrowser();
    const ch = supa.channel(`user:${me.userId}`);
    ch.on("broadcast", { event: "ping" }, () => {
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
      qc.invalidateQueries({ queryKey: ["chat", "unread-total"] });
    }).subscribe();
    return () => { supa.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="flex flex-1 min-h-0 flex-col h-full w-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Conversations</h2>
        </div>
        <Link
          to="/chat/new"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent active:scale-95 transition"
        >
          <Plus className="h-3 w-3" /> Private
        </Link>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <ul className="divide-y divide-border">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                  <div className="h-2.5 w-3/4 bg-muted/70 animate-pulse rounded" />
                </div>
              </li>
            ))}
          </ul>
        ) : !data || data.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No conversations yet. They appear automatically when you join a business.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((c) => {
              const unread = c.unread > 0;
              return (
                <li key={c.id}>
                  <Link
                    to="/chat/$conversationId"
                    params={{ conversationId: c.id }}
                    className="group flex items-start gap-3 px-4 py-3 min-h-[64px] hover:bg-accent hover:text-accent-foreground active:bg-accent/80 transition-colors data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
                    activeProps={{ "data-status": "active" } as any}
                  >
                    <div className="h-9 w-9 shrink-0 grid place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground group-data-[status=active]:bg-accent-foreground/10 group-data-[status=active]:text-accent-foreground">
                      {c.kind === "group" ? <UsersIcon className="h-4 w-4" /> : c.title.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`text-sm truncate flex-1 ${unread ? "font-semibold" : "font-medium"}`}>{c.title}</div>
                        <div className="text-[10px] text-muted-foreground shrink-0 group-hover:text-accent-foreground/70 group-data-[status=active]:text-accent-foreground/70">
                          {formatRelative(c.lastMessageAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className={`text-xs truncate flex-1 group-hover:text-accent-foreground/80 group-data-[status=active]:text-accent-foreground/80 ${unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {c.lastMessage ?? (c.kind === "group" ? "Group · No messages yet" : "No messages yet")}
                        </div>
                        {unread && (
                          <Badge className="h-5 min-w-5 px-1.5 text-[10px] shrink-0">{c.unread}</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

