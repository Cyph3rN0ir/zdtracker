// Server-only push delivery helpers. Imports web-push (Node-compatible
// under Cloudflare nodejs_compat). Never import from client modules.
import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase.server";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.ZEROSYNC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.ZEROSYNC_VAPID_PRIVATE_KEY ?? process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.ZEROSYNC_VAPID_SUBJECT ?? process.env.VAPID_SUBJECT ?? "mailto:notify@zerosync.pages.dev";
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badgeCount?: number;
  data?: Record<string, unknown>;
};

export type PushDeliveryReport = {
  configured: boolean;
  subscriptions: number;
  sent: number;
  failed: number;
  stale: number;
  reason?: string;
};

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  perUser?: Record<string, Partial<PushPayload>>,
): Promise<PushDeliveryReport> {
  if (!userIds.length) {
    return { configured: true, subscriptions: 0, sent: 0, failed: 0, stale: 0, reason: "no-users" };
  }
  try {
    configure();
  } catch (e) {
    console.warn("[push] not configured:", (e as Error).message);
    return { configured: false, subscriptions: 0, sent: 0, failed: 0, stale: 0, reason: "not-configured" };
  }
  const supa = getSupabaseAdmin();
  const { data: subs, error } = await supa
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .in("user_id", userIds);
  if (error) {
    console.warn("[push] fetch subs failed", error.message);
    return { configured: true, subscriptions: 0, sent: 0, failed: 0, stale: 0, reason: "subscription-query-failed" };
  }
  if (!subs?.length) {
    return { configured: true, subscriptions: 0, sent: 0, failed: 0, stale: 0, reason: "no-subscriptions" };
  }

  const stale: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      const merged = { ...payload, ...(perUser?.[s.user_id] ?? {}) };
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(merged),
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) stale.push(s.id);
        else {
          failed += 1;
          console.warn("[push] send failed", code, err?.body);
        }
      }
    }),
  );

  if (stale.length) {
    await supa.from("push_subscriptions").delete().in("id", stale);
  }

  return {
    configured: true,
    subscriptions: subs.length,
    sent,
    failed,
    stale: stale.length,
    reason: sent > 0 ? undefined : stale.length ? "stale-subscriptions" : "send-failed",
  };
}
