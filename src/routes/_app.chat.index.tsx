import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_app/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  return (
    <div className="hidden md:flex h-full items-center justify-center text-center p-8">
      <div>
        <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-muted">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Select a conversation to start chatting.</p>
      </div>
    </div>
  );
}
