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

function ConversationListPanel() {
  const list = useServerFn(listConversationsFn);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => list(),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  // Subscribe to a per-user channel for cross-conversation pings
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Read user id from cached me; for simplicity refetch on any visibility change
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
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
        >
          <Plus className="h-3 w-3" /> Private
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No conversations yet. They appear automatically when you join a business.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((c) => (
              <li key={c.id}>
                <Link
                  to="/chat/$conversationId"
                  params={{ conversationId: c.id }}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors data-[status=active]:bg-accent"
                  activeProps={{ "data-status": "active" } as any}
                >
                  <div className="h-9 w-9 shrink-0 grid place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {c.kind === "group" ? <UsersIcon className="h-4 w-4" /> : c.title.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm truncate flex-1">{c.title}</div>
                      {c.unread > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 text-[10px]">{c.unread}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      <span>{c.kind === "group" ? "Group" : c.subtitle}</span>
                      <span> · </span>
                      <span>{c.lastMessage ?? "No messages yet"}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
