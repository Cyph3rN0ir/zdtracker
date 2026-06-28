// Server-only push delivery helpers. Imports web-push (Node-compatible
// under Cloudflare nodejs_compat). Never import from client modules.
import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase.server";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:notify@zerosync.app";
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

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  perUser?: Record<string, Partial<PushPayload>>,
) {
  if (!userIds.length) return;
  try {
    configure();
  } catch (e) {
    console.warn("[push] not configured:", (e as Error).message);
    return;
  }
  const supa = getSupabaseAdmin();
  const { data: subs, error } = await supa
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .in("user_id", userIds);
  if (error) {
    console.warn("[push] fetch subs failed", error.message);
    return;
  }
  if (!subs?.length) return;

  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      const merged = { ...payload, ...(perUser?.[s.user_id] ?? {}) };
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(merged),
          { TTL: 60 * 60 * 24 },
        );
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) stale.push(s.id);
        else console.warn("[push] send failed", code, err?.body);
      }
    }),
  );

  if (stale.length) {
    await supa.from("push_subscriptions").delete().in("id", stale);
  }
}
