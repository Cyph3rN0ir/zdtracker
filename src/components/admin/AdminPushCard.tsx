import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { adminSendPushFn } from "@/lib/admin-push.functions";
import { listUsersFn } from "@/lib/auth.functions";

type Target = "all" | "user";

export function AdminPushCard() {
  const send = useServerFn(adminSendPushFn);
  const list = useServerFn(listUsersFn);
  const users = useQuery({ queryKey: ["users"], queryFn: () => list() });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [target, setTarget] = useState<Target>("all");
  const [userId, setUserId] = useState<string>("");

  const m = useMutation({
    mutationFn: () => send({ data: { title, body, url, target, userId: target === "user" ? userId : null } }),
    onSuccess: (r: any) => {
      if (!r.recipients) {
        toast.warning("0 devices subscribed. Ask recipients to open Settings → Enable notifications first.");
        return;
      }
      if (!r.sent) {
        toast.error(r.reason === "not-configured" ? "Push keys are missing on this deployment" : `No notification was delivered${r.reason ? ` (${r.reason})` : ""}. Re-enable notifications on the target device and try again.`);
        return;
      }
      toast.success(`Delivered to ${r.sent} ${r.sent === 1 ? "device" : "devices"}`);
      setTitle(""); setBody("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return toast.error("Title and message required");
    if (target === "user" && !userId) return toast.error("Pick a user");
    m.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send push notification</CardTitle>
        <CardDescription>Broadcast to everyone or pick a single user. Only devices with notifications enabled will receive it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Target</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as Target)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users (broadcast)</SelectItem>
                <SelectItem value="user">Specific user</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>User</Label>
            <Select value={userId} onValueChange={setUserId} disabled={target !== "user" || users.isLoading}>
              <SelectTrigger><SelectValue placeholder={target === "user" ? "Pick a user…" : "—"} /></SelectTrigger>
              <SelectContent>
                {(users.data ?? []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.display_name || u.username} ({u.username})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Title</Label>
            <Input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Heads up" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Message</Label>
            <Textarea maxLength={300} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Open URL (optional)</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/" />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={m.isPending} className="w-full gap-2 sm:w-auto">
              <Send className="h-4 w-4" /> {m.isPending ? "Sending…" : "Send notification"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
