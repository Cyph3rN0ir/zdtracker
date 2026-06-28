import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession, requireMember, broadcast } from "@/lib/chat.server";

// ---------------- List conversations ----------------
export const listConversationsFn = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireSession();
  const { getSupabaseAdmin } = await import("@/lib/supabase.server");
  const supa = getSupabaseAdmin();

  const { data: mems, error: e1 } = await supa
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", me.userId!);
  if (e1) throw new Error(e1.message);
  const memMap = new Map<string, string>(); // convId -> last_read_at
  for (const m of mems ?? []) memMap.set(m.conversation_id, m.last_read_at);
  const ids = Array.from(memMap.keys());
  if (ids.length === 0) return [];

  const { data: convs, error: e2 } = await supa
    .from("conversations")
    .select("id, kind, business_id, created_at")
    .in("id", ids);
  if (e2) throw new Error(e2.message);

  const businessIds = Array.from(new Set((convs ?? []).map((c) => c.business_id)));
  const { data: bizs } = await supa.from("businesses").select("id, name").in("id", businessIds);
  const bizMap = new Map((bizs ?? []).map((b) => [b.id, b.name as string]));

  // Other members (for direct title)
  const { data: allMembers } = await supa
    .from("conversation_members")
    .select("conversation_id, user_id")
    .in("conversation_id", ids);
  const userIdsSet = new Set<string>();
  for (const m of allMembers ?? []) if (m.user_id !== me.userId) userIdsSet.add(m.user_id);
  const { data: users } = userIdsSet.size
    ? await supa
        .from("app_users")
        .select("id, username, display_name")
        .in("id", Array.from(userIdsSet))
    : { data: [] as Array<{ id: string; username: string; display_name: string | null }> };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  // Last message + unread count per conversation (small N — issue per-conv queries).
  const result: Array<{
    id: string;
    kind: "group" | "direct";
    businessId: string;
    businessName: string;
    title: string;
    subtitle: string;
    otherUserId: string | null;
    lastMessage: string | null;
    lastMessageAt: string | null;
    unread: number;
  }> = [];

  for (const c of convs ?? []) {
    const { data: lastArr } = await supa
      .from("messages")
      .select("body, created_at, sender_id")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const last = lastArr?.[0] ?? null;

    const lastRead = memMap.get(c.id) ?? new Date(0).toISOString();
    const { count: unread } = await supa
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id)
      .gt("created_at", lastRead)
      .neq("sender_id", me.userId!);

    const businessName = bizMap.get(c.business_id) ?? "";
    let title = businessName;
    let subtitle = "Group";
    let otherUserId: string | null = null;
    if (c.kind === "direct") {
      const other = (allMembers ?? []).find(
        (m) => m.conversation_id === c.id && m.user_id !== me.userId,
      );
      otherUserId = other?.user_id ?? null;
      const u = otherUserId ? userMap.get(otherUserId) : undefined;
      title = (u?.display_name && u.display_name.trim()) || u?.username || "Direct";
      subtitle = businessName;
    }

    result.push({
      id: c.id,
      kind: c.kind as "group" | "direct",
      businessId: c.business_id,
      businessName,
      title,
      subtitle,
      otherUserId,
      lastMessage: last?.body ?? null,
      lastMessageAt: last?.created_at ?? c.created_at,
      unread: unread ?? 0,
    });
  }

  result.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  return result;
});

// ---------------- Conversation details ----------------
export const getConversationFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await requireMember(data.conversationId, me.userId!);
    const { data: c, error } = await supa
      .from("conversations")
      .select("id, kind, business_id, created_at")
      .eq("id", data.conversationId)
      .single();
    if (error) throw new Error(error.message);

    const { data: biz } = await supa
      .from("businesses")
      .select("name")
      .eq("id", c.business_id)
      .single();

    const { data: members } = await supa
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", c.id);
    const memberIds = (members ?? []).map((m) => m.user_id);
    const { data: users } = memberIds.length
      ? await supa
          .from("app_users")
          .select("id, username, display_name")
          .in("id", memberIds)
      : { data: [] as Array<{ id: string; username: string; display_name: string | null }> };

    const usersOut = (users ?? []).map((u) => ({
      id: u.id,
      name: (u.display_name && u.display_name.trim()) || u.username,
    }));

    let title = biz?.name ?? "";
    if (c.kind === "direct") {
      const other = usersOut.find((u) => u.id !== me.userId);
      title = other?.name ?? "Direct";
    }

    return {
      id: c.id,
      kind: c.kind as "group" | "direct",
      businessId: c.business_id,
      businessName: biz?.name ?? "",
      title,
      members: usersOut,
    };
  });

// ---------------- List messages ----------------
export const listMessagesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await requireMember(data.conversationId, me.userId!);

    const { data: msgs, error } = await supa
      .from("messages")
      .select("id, sender_id, body, reply_to_id, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const rows = (msgs ?? []).slice().reverse();

    // All members + their last_read_at (for read receipts)
    const { data: memberRows } = await supa
      .from("conversation_members")
      .select("user_id, last_read_at")
      .eq("conversation_id", data.conversationId);
    const otherMembers = (memberRows ?? []).filter((m) => m.user_id !== me.userId);

    const senderIds = Array.from(
      new Set(rows.map((m) => m.sender_id).filter((x): x is string => !!x)),
    );
    const allUserIds = Array.from(
      new Set([...senderIds, ...otherMembers.map((m) => m.user_id)]),
    );
    const { data: users } = allUserIds.length
      ? await supa
          .from("app_users")
          .select("id, username, display_name")
          .in("id", allUserIds)
      : { data: [] as Array<{ id: string; username: string; display_name: string | null }> };
    const nameMap = new Map(
      (users ?? []).map((u) => [u.id, (u.display_name && u.display_name.trim()) || u.username]),
    );

    const replyIds = Array.from(
      new Set(rows.map((m) => m.reply_to_id).filter((x): x is string => !!x)),
    );
    const { data: replies } = replyIds.length
      ? await supa
          .from("messages")
          .select("id, body, sender_id")
          .in("id", replyIds)
      : { data: [] as Array<{ id: string; body: string; sender_id: string | null }> };
    const replyMap = new Map(
      (replies ?? []).map((r) => [
        r.id,
        {
          body: r.body,
          senderName: r.sender_id ? nameMap.get(r.sender_id) ?? "User" : "Unknown",
        },
      ]),
    );

    return rows.map((m) => {
      const mine = m.sender_id === me.userId;
      // Read receipts: which OTHER members have last_read_at >= this message's createdAt
      const readers = mine
        ? otherMembers
            .filter((mem) => mem.last_read_at && mem.last_read_at >= m.created_at)
            .map((mem) => ({
              id: mem.user_id,
              name: nameMap.get(mem.user_id) ?? "User",
            }))
        : [];
      return {
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender_id ? nameMap.get(m.sender_id) ?? "User" : "Unknown",
        body: m.body,
        createdAt: m.created_at,
        replyTo: m.reply_to_id
          ? { id: m.reply_to_id, ...(replyMap.get(m.reply_to_id) ?? { body: "(deleted)", senderName: "Unknown" }) }
          : null,
        mine,
        readers,
        readByAll: mine && otherMembers.length > 0 && readers.length === otherMembers.length,
        otherMembersCount: otherMembers.length,
      };
    });
  });

// ---------------- Send message ----------------
export const sendMessageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        replyToId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await requireMember(data.conversationId, me.userId!);

    if (data.replyToId) {
      const { data: r } = await supa
        .from("messages")
        .select("conversation_id")
        .eq("id", data.replyToId)
        .maybeSingle();
      if (!r || r.conversation_id !== data.conversationId) {
        throw new Error("Reply target invalid");
      }
    }

    const { data: inserted, error } = await supa
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        sender_id: me.userId,
        body: data.body,
        reply_to_id: data.replyToId ?? null,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);

    // Mark sender's own message as read
    await supa
      .from("conversation_members")
      .update({ last_read_at: inserted.created_at })
      .eq("conversation_id", data.conversationId)
      .eq("user_id", me.userId!);

    // Broadcast to conversation channel + per-recipient channels for list updates
    await broadcast(`conv:${data.conversationId}`, { messageId: inserted.id });

    const { data: members } = await supa
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", data.conversationId);
    const recipients = (members ?? [])
      .filter((m) => m.user_id !== me.userId)
      .map((m) => m.user_id);

    await Promise.all(
      recipients.map((uid) => broadcast(`user:${uid}`, { conversationId: data.conversationId })),
    );

    // Fire-and-forget push notifications. Keep this cheap so message send
    // stays snappy: skip the badge-count N+1 and bail early when no
    // recipient has any push subscriptions.
    try {
      const { data: anySubs } = await supa
        .from("push_subscriptions")
        .select("user_id")
        .in("user_id", recipients)
        .limit(1);
      if (anySubs && anySubs.length) {
        const { sendPushToUsers } = await import("@/lib/push.server");
        const { data: sender } = await supa
          .from("app_users")
          .select("display_name, username")
          .eq("id", me.userId!)
          .maybeSingle();
        const senderName = sender?.display_name || sender?.username || "Someone";
        const preview = data.body.length > 140 ? data.body.slice(0, 140) + "…" : data.body;

        // Don't await — let the worker continue while delivery happens.
        // Recipients also get a service-worker `push` message that triggers
        // an unread-count refresh in any open client.
        void sendPushToUsers(recipients, {
          title: senderName,
          body: preview,
          url: `/chat/${data.conversationId}`,
          tag: `conv:${data.conversationId}`,
          data: { conversationId: data.conversationId, messageId: inserted.id },
        });
      }
    } catch (e) {
      console.warn("[chat] push dispatch failed", (e as Error).message);
    }


    return { id: inserted.id };
  });

// ---------------- Mark read ----------------
export const markReadFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await requireMember(data.conversationId, me.userId!);
    const { error } = await supa
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .eq("user_id", me.userId!);
    if (error) throw new Error(error.message);
    // Notify others in the conversation so sender's "seen" state updates live
    await broadcast(`conv:${data.conversationId}`, { readBy: me.userId });
    return { ok: true };
  });

// ---------------- Peers (potential direct-chat targets) ----------------
export const listChatPeersFn = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireSession();
  const { getSupabaseAdmin } = await import("@/lib/supabase.server");
  const supa = getSupabaseAdmin();

  // Find businesses the user belongs to (created_by OR business_members)
  const { data: mems } = await supa
    .from("business_members")
    .select("business_id")
    .eq("user_id", me.userId!);
  const { data: owned } = await supa
    .from("businesses")
    .select("id")
    .eq("created_by", me.userId!);

  const businessIds = Array.from(
    new Set([...(mems ?? []).map((m) => m.business_id), ...(owned ?? []).map((b) => b.id)]),
  );
  if (businessIds.length === 0) return [];

  const { data: bizs } = await supa
    .from("businesses")
    .select("id, name, created_by")
    .in("id", businessIds);
  const { data: allMems } = await supa
    .from("business_members")
    .select("business_id, user_id")
    .in("business_id", businessIds);

  // peerId -> [{businessId, businessName}]
  const peerToBiz = new Map<string, Array<{ businessId: string; businessName: string }>>();
  const bizNameMap = new Map((bizs ?? []).map((b) => [b.id, b.name as string]));
  function add(peerId: string, bizId: string) {
    if (peerId === me.userId) return;
    const list = peerToBiz.get(peerId) ?? [];
    if (!list.some((x) => x.businessId === bizId)) {
      list.push({ businessId: bizId, businessName: bizNameMap.get(bizId) ?? "" });
    }
    peerToBiz.set(peerId, list);
  }
  for (const m of allMems ?? []) add(m.user_id, m.business_id);
  for (const b of bizs ?? []) if (b.created_by) add(b.created_by as string, b.id);

  const peerIds = Array.from(peerToBiz.keys());
  if (peerIds.length === 0) return [];

  const { data: users } = await supa
    .from("app_users")
    .select("id, username, display_name, role")
    .in("id", peerIds);

  return (users ?? []).map((u) => ({
    id: u.id,
    name: (u.display_name && u.display_name.trim()) || u.username,
    username: u.username,
    role: u.role as string,
    businesses: peerToBiz.get(u.id) ?? [],
  }));
});

// ---------------- Open or create a direct conversation ----------------
export const openDirectConversationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ otherUserId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    if (data.otherUserId === me.userId) throw new Error("Cannot chat with yourself");
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();

    // Verify shared business
    const { data: myMems } = await supa
      .from("business_members")
      .select("business_id")
      .eq("user_id", me.userId!);
    const { data: myOwned } = await supa
      .from("businesses")
      .select("id")
      .eq("created_by", me.userId!);
    const mySet = new Set<string>([
      ...(myMems ?? []).map((m) => m.business_id),
      ...(myOwned ?? []).map((b) => b.id),
    ]);

    const { data: otherMems } = await supa
      .from("business_members")
      .select("business_id")
      .eq("user_id", data.otherUserId);
    const { data: otherOwned } = await supa
      .from("businesses")
      .select("id")
      .eq("created_by", data.otherUserId);
    const otherSet = new Set<string>([
      ...(otherMems ?? []).map((m) => m.business_id),
      ...(otherOwned ?? []).map((b) => b.id),
    ]);

    const shared = Array.from(mySet).find((id) => otherSet.has(id));
    if (!shared) throw new Error("You don't share a business with this user");

    // Find existing direct conversation between the two
    const { data: myConvs } = await supa
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", me.userId!);
    const myConvIds = (myConvs ?? []).map((c) => c.conversation_id);
    if (myConvIds.length > 0) {
      const { data: directs } = await supa
        .from("conversations")
        .select("id")
        .in("id", myConvIds)
        .eq("kind", "direct");
      const directIds = (directs ?? []).map((d) => d.id);
      if (directIds.length > 0) {
        const { data: otherInDirect } = await supa
          .from("conversation_members")
          .select("conversation_id")
          .in("conversation_id", directIds)
          .eq("user_id", data.otherUserId);
        const existing = otherInDirect?.[0]?.conversation_id;
        if (existing) return { id: existing };
      }
    }

    // Create new direct conversation
    const { data: created, error } = await supa
      .from("conversations")
      .insert({ business_id: shared, kind: "direct" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: e2 } = await supa.from("conversation_members").insert([
      { conversation_id: created.id, user_id: me.userId! },
      { conversation_id: created.id, user_id: data.otherUserId },
    ]);
    if (e2) throw new Error(e2.message);

    return { id: created.id };
  });

// ---------------- Unread total (for nav badge) ----------------
export const unreadTotalFn = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireSession();
  const { getSupabaseAdmin } = await import("@/lib/supabase.server");
  const supa = getSupabaseAdmin();
  const { data: mems } = await supa
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", me.userId!);
  let total = 0;
  for (const m of mems ?? []) {
    const { count } = await supa
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", m.conversation_id)
      .gt("created_at", m.last_read_at)
      .neq("sender_id", me.userId!);
    total += count ?? 0;
  }
  return { total };
});
