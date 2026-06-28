import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/chat.server";
import { VAPID_PUBLIC_KEY as FALLBACK_PUBLIC_KEY } from "@/lib/push-config";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(500).optional().nullable(),
});

export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subscriptionSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    const { error } = await supa
      .from("push_subscriptions")
      .upsert(
        {
          user_id: me.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscriptionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    await supa
      .from("push_subscriptions")
      .delete()
      .eq("user_id", me.userId!)
      .eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const getPushPublicConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const envPublic =
    process.env.ZEROSYNC_VAPID_PUBLIC_KEY ??
    process.env.VAPID_PUBLIC_KEY ??
    process.env.WEB_PUSH_PUBLIC_KEY ??
    null;
  const privateKey =
    process.env.ZEROSYNC_VAPID_PRIVATE_KEY ??
    process.env.VAPID_PRIVATE_KEY ??
    process.env.WEB_PUSH_PRIVATE_KEY ??
    null;
  const subject =
    process.env.ZEROSYNC_VAPID_SUBJECT ??
    process.env.VAPID_SUBJECT ??
    process.env.WEB_PUSH_SUBJECT ??
    "https://zerosync.pages.dev/";
  const publicKey = envPublic ?? FALLBACK_PUBLIC_KEY;
  const missing = [
    !privateKey ? "ZEROSYNC_VAPID_PRIVATE_KEY" : null,
  ].filter(Boolean) as string[];
  return { configured: missing.length === 0, publicKey, subject, missing };
});

export const sendTestPushFn = createServerFn({ method: "POST" }).handler(async () => {
  const me = await requireSession();
  const { sendPushToUsers } = await import("@/lib/push.server");
  const report = await sendPushToUsers([me.userId!], {
    title: "ZeroSync",
    body: "Push notifications are working 🎉",
    url: "/chat",
    tag: "test",
  });
  return { ok: report.sent > 0, ...report };
});
