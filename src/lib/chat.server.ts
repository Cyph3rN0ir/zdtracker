import { getSession } from "@/lib/session.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";

export async function requireSession() {
  const s = await getSession();
  if (!s.data.userId) throw new Error("Not signed in");
  return s.data;
}

export async function requireMember(conversationId: string, userId: string) {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
  return supa;
}

export async function broadcast(channelName: string, payload: Record<string, unknown>) {
  const supa = getSupabaseAdmin();
  const ch = supa.channel(channelName, { config: { broadcast: { ack: false } } });
  try {
    await ch.send({ type: "broadcast", event: "ping", payload });
  } finally {
    await supa.removeChannel(ch);
  }
}
