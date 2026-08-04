import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession, requireMember, broadcast } from "./chat.server";

export const toggleReactionFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    messageId: z.string().uuid(),
    emoji: z.string().min(1)
  }))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();

    // Verify user has access to this message's conversation
    const { data: msg } = await supa
      .from("messages")
      .select("conversation_id")
      .eq("id", data.messageId)
      .single();
    if (!msg) throw new Error("Message not found");
    await requireMember(msg.conversation_id, me.userId!);

    const { data: existing } = await supa
      .from("message_reactions")
      .select("id")
      .eq("message_id", data.messageId)
      .eq("user_id", me.userId!)
      .eq("emoji", data.emoji)
      .maybeSingle();

    if (existing) {
      await supa.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supa.from("message_reactions").insert({
        message_id: data.messageId,
        user_id: me.userId,
        emoji: data.emoji
      });
    }

    await broadcast(`conv:${msg.conversation_id}`, { reactionsChanged: true, messageId: data.messageId });
    return { ok: true };
  });
