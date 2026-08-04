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
    // Note: In some serverless environments like Workers, .send() might be buffered 
    // or need an await to ensure the network request completes before the worker exits.
    await ch.send({ type: "broadcast", event: "ping", payload });
  } finally {
    // Wait a tiny bit for the broadcast to actually leave the outbound buffer
    // if using a standard Supabase client in a non-long-running process.
    await new Promise(r => setTimeout(r, 50));
    await supa.removeChannel(ch);
  }
}

/**
 * A business group chat should always mirror the business roster: every
 * business member (plus its creator) belongs to the group conversation.
 * Members added to the business after the conversation was created were never
 * inserted here, which is why new people didn't see the group chat. This
 * reconciles the two, additively — it never removes anyone, so admin-managed
 * extra participants survive.
 */
export async function syncBusinessGroupMembers(businessId: string, conversationId: string) {
  const supa = getSupabaseAdmin();

  const [{ data: biz }, { data: bizMems }, { data: convMems }] = await Promise.all([
    supa.from("businesses").select("created_by").eq("id", businessId).maybeSingle(),
    supa.from("business_members").select("user_id").eq("business_id", businessId),
    supa.from("conversation_members").select("user_id").eq("conversation_id", conversationId),
  ]);

  const should = new Set<string>((bizMems ?? []).map((m) => m.user_id));
  if (biz?.created_by) should.add(biz.created_by);
  const have = new Set<string>((convMems ?? []).map((m) => m.user_id));

  const missing = Array.from(should).filter((id) => id && !have.has(id));
  if (missing.length === 0) return { added: 0 };

  const { error } = await supa.from("conversation_members").insert(
    missing.map((user_id) => ({ conversation_id: conversationId, user_id })),
  );
  // Ignore unique-violation races: another request may have inserted first.
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    throw new Error(error.message);
  }
  return { added: missing.length };
}

/**
 * Ensures a business has its group conversation and that its roster is in
 * sync. Returns the conversation id.
 */
export async function ensureBusinessGroup(businessId: string) {
  const supa = getSupabaseAdmin();
  const { data: existing } = await supa
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("kind", "group")
    .maybeSingle();

  let convId = existing?.id as string | undefined;
  if (!convId) {
    const { data: created, error } = await supa
      .from("conversations")
      .insert({ business_id: businessId, kind: "group" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    convId = created.id;
  }
  await syncBusinessGroupMembers(businessId, convId!);
  return convId!;
}

/** Global admins are the only ones allowed to curate group membership. */
export async function requireAdmin(userId: string) {
  const supa = getSupabaseAdmin();
  const { data } = await supa.from("app_users").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "admin") throw new Error("Forbidden");
  return supa;
}
