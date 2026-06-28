import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSession } from "@/lib/session.server";

const schema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(300),
  url: z.string().trim().max(500).optional().nullable(),
  target: z.enum(["all", "user"]),
  userId: z.string().uuid().optional().nullable(),
});

export const adminSendPushFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const s = await getSession();
    if (s.data.role !== "admin") throw new Error("Forbidden");

    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { sendPushToUsers } = await import("@/lib/push.server");
    const supa = getSupabaseAdmin();

    let userIds: string[] = [];
    if (data.target === "user") {
      if (!data.userId) throw new Error("Select a user");
      userIds = [data.userId];
    } else {
      const { data: rows, error } = await supa
        .from("push_subscriptions")
        .select("user_id");
      if (error) throw new Error(error.message);
      userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    }

    if (!userIds.length) return { ok: true, recipients: 0 };

    await sendPushToUsers(userIds, {
      title: data.title,
      body: data.body,
      url: data.url || "/",
      tag: `admin-${Date.now()}`,
    });
    return { ok: true, recipients: userIds.length };
  });
