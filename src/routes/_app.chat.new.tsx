import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listChatPeersFn, openDirectConversationFn } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/chat/new")({
  component: NewDirectChat,
});

function NewDirectChat() {
  const list = useServerFn(listChatPeersFn);
  const open = useServerFn(openDirectConversationFn);
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const peersQ = useQuery({
    queryKey: ["chat", "peers"],
    queryFn: () => list(),
  });

  const start = useMutation({
    mutationFn: (otherUserId: string) => open({ data: { otherUserId } }),
    onSuccess: (r) => navigate({ to: "/chat/$conversationId", params: { conversationId: r.id } }),
  });

  const filtered = (peersQ.data ?? []).filter((p) =>
    !q.trim() ? true : (p.name + " " + p.username).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full bg-background">
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
        <div className="font-semibold text-sm">Start a private chat</div>
      </header>
      <div className="p-3 border-b border-border">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {peersQ.isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No people available. You can only chat with members of businesses you share.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => start.mutate(p.id)}
                  disabled={start.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left disabled:opacity-50"
                >
                  <div className="h-9 w-9 shrink-0 grid place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.businesses.map((b) => b.businessName).join(", ")}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
