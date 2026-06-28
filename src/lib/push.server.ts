// Server-only push delivery helpers. Never import from client modules.
import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase.server";

let configured = false;
function readConfig() {
  const publicKey = process.env.ZEROSYNC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.ZEROSYNC_VAPID_PRIVATE_KEY ?? process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.ZEROSYNC_VAPID_SUBJECT ?? process.env.VAPID_SUBJECT ?? "https://zerosync.pages.dev/";
  return { publicKey, privateKey, subject };
}

export function getPushPublicConfig() {
  const cfg = readConfig();
  return {
    configured: Boolean(cfg.publicKey && cfg.privateKey),
    publicKey: cfg.publicKey ?? null,
    subject: cfg.subject,
  };
}

function configure() {
  if (configured) return;
  const cfg = readConfig();
  if (!cfg.publicKey || !cfg.privateKey) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  configured = true;
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) {
  const cfg = readConfig();
  if (!cfg.publicKey || !cfg.privateKey) throw new Error("VAPID keys not configured");

  // web-push's sendNotification uses Node's https.request internally. The
  // app runs in an edge runtime, so generate the encrypted Web Push request
  // with web-push, then deliver it with the runtime-native fetch API.
  const req = webpush.generateRequestDetails(subscription, payload, {
    TTL: 60 * 60 * 24,
    urgency: "high",
    vapidDetails: {
      subject: cfg.subject,
      publicKey: cfg.publicKey,
      privateKey: cfg.privateKey,
    },
  });

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    // Runtime fetch owns these transport headers. Keeping Content-Length from
    // Node's request builder can make edge fetch reject the request before it
    // reaches FCM/WNS/APNs.
    if (key.toLowerCase() === "content-length") continue;
    headers.set(key, String(value));
  }

  const response = await fetch(req.endpoint, {
    method: req.method,
    headers,
    body: req.body ? new Uint8Array(req.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const err = new Error(`Push endpoint returned ${response.status}`) as Error & {
      statusCode?: number;
      body?: string;
    };
    err.statusCode = response.status;
    err.body = body;
    throw err;
  }
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
        await sendWebPush(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(merged),
        );
        sent += 1;
      } catch (err: any) {
        const code = err?.statusCode;
        // 404/410 are expired endpoints. FCM/WNS also return 401/403 when a
        // subscription was created with an older VAPID key, which is equally
        // unrecoverable server-side; the client must subscribe again with the
        // current public key.
        if (code === 400 || code === 401 || code === 403 || code === 404 || code === 410) stale.push(s.id);
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
