import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getPushPublicConfigFn,
  removePushSubscriptionFn,
  savePushSubscriptionFn,
  sendTestPushFn,
} from "@/lib/push.functions";
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from "@/lib/push-config";

type State = "unsupported" | "blocked" | "server-off" | "off" | "on" | "loading";

const PUSH_SW_URL = "/push-sw.js";
const PUSH_SW_SCOPE = "/push/";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function bytesEqual(a: Uint8Array, b: Uint8Array) {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function subscriptionUsesCurrentKey(sub: PushSubscription, publicKey: string) {
  const key = sub.options.applicationServerKey;
  if (!key) return false;
  return bytesEqual(new Uint8Array(key), urlBase64ToUint8Array(publicKey));
}

async function waitForActiveRegistration(reg: ServiceWorkerRegistration) {
  if (reg.active) return reg;
  const worker = reg.installing ?? reg.waiting;
  if (!worker) return reg;
  await Promise.race([
    new Promise<void>((resolve) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve();
      });
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 4000)),
  ]);
  return reg;
}

async function getPushRegistration() {
  const existing = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE);
  if (existing) return waitForActiveRegistration(existing);
  const reg = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: PUSH_SW_SCOPE });
  return waitForActiveRegistration(reg);
}

async function getLegacyAppShellSubscriptions() {
  const regs = await navigator.serviceWorker.getRegistrations();
  const legacy: PushSubscription[] = [];
  for (const reg of regs) {
    if (reg.scope.endsWith(PUSH_SW_SCOPE)) continue;
    const sub = await reg.pushManager.getSubscription().catch(() => null);
    if (sub) legacy.push(sub);
  }
  return legacy;
}

export function EnablePushButton() {
  const [state, setState] = useState<State>("loading");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const getConfig = useServerFn(getPushPublicConfigFn);
  const save = useServerFn(savePushSubscriptionFn);
  const remove = useServerFn(removePushSubscriptionFn);
  const test = useServerFn(sendTestPushFn);

  async function loadPublicKey() {
    const cfg = await getConfig();
    if (!cfg?.configured || !cfg.publicKey) {
      setStatusText("Notification keys are not ready on the server yet.");
      setState("server-off");
      return null;
    }
    return cfg.publicKey || VAPID_PUBLIC_KEY;
  }

  async function refresh() {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    // PWA features (including SW registration) are disabled on Lovable
    // preview hosts and inside iframes — getSubscription would hang on
    // serviceWorker.ready forever. Surface a clear message instead.
    try {
      const { shouldDisablePwaFeatures } = await import("@/lib/pwa-host-guard");
      if (shouldDisablePwaFeatures()) { setState("unsupported"); return; }
    } catch {}
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    try {
      // Use a dedicated push worker. The offline app-shell worker is generated
      // at /sw.js and must not own notification subscriptions, otherwise its
      // generated script may not contain a push handler after deploys.
      const reg = await Promise.race<ServiceWorkerRegistration | null>([
        getPushRegistration(),
        new Promise<null>((r) => setTimeout(() => r(null), 4000)),
      ]);
      if (!reg) { setState("unsupported"); return; }
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const publicKey = await loadPublicKey();
        if (!publicKey) return;
        if (!subscriptionUsesCurrentKey(sub, publicKey)) {
          setEndpoint(null);
          setStatusText("This device has an old notification registration. Enable once to repair it.");
          setState("off");
          return;
        }
        setEndpoint(sub.endpoint);
        setState("on");
      } else {
        setState("off");
      }
    } catch {
      setState("off");
    }
  }


  useEffect(() => {
    refresh();
  }, []);

  async function ensureSubscription() {
    const publicKey = await loadPublicKey();
    if (!publicKey) throw new Error("Push keys are not configured on the server");

    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "blocked" : "off");
        throw new Error("Notification permission was not granted");
      }
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      throw new Error("Notifications are blocked in browser settings");
    }

    // Older builds attached push subscriptions to the generated offline
    // worker at /sw.js. That worker may accept pushes but not display them
    // after deploys, so migrate those endpoints away before saving the
    // stable /push-sw.js subscription.
    const legacySubs = await getLegacyAppShellSubscriptions();
    for (const legacy of legacySubs) {
      const ep = legacy.endpoint;
      await legacy.unsubscribe().catch(() => false);
      await remove({ data: { endpoint: ep } }).catch(() => null);
    }

    const reg = await getPushRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (sub && !subscriptionUsesCurrentKey(sub, publicKey)) {
      const oldEndpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => false);
      await remove({ data: { endpoint: oldEndpoint } }).catch(() => null);
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    const json = sub.toJSON();
    await save({
      data: {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 500),
      },
    });
    setEndpoint(sub.endpoint);
    setStatusText(null);
    setState("on");
    return { sub, repaired: legacySubs.length > 0 };
  }

  async function enable() {
    setState("loading");
    try {
      const result = await ensureSubscription();
      toast.success(result.repaired ? "Notifications repaired and enabled" : "Notifications enabled");
    } catch (e) {
      console.error("[push] enable failed", e);
      toast.error((e as Error)?.message || "Could not enable notifications");
      await refresh();
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await getPushRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const ep = sub.endpoint;
        await sub.unsubscribe();
        await remove({ data: { endpoint: ep } });
      }
      setEndpoint(null);
      setState("off");
      toast.success("Notifications disabled");
    } catch (e) {
      console.error("[push] disable failed", e);
      toast.error("Could not disable notifications");
      await refresh();
    }
  }

  async function sendTest() {
    setState("loading");
    try {
      await ensureSubscription();
      const result: any = await test();
      if (result?.sent > 0) {
        toast.success("Test notification delivered");
      } else if (result?.reason === "no-subscriptions") {
        toast.warning("This device is not subscribed yet. Disable and enable notifications once, then try again.");
        await refresh();
      } else if (result?.reason === "not-configured") {
        toast.error("Push keys are not configured on the server");
      } else {
        toast.error(`No notification was delivered${result?.reason ? ` (${result.reason})` : ""}.`);
        await refresh();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send test");
      await refresh();
    }
  }

  if (state === "loading") {
    return (
      <Button size="sm" variant="outline" disabled className="gap-2">
        <Bell className="h-4 w-4" /> …
      </Button>
    );
  }

  if (state === "unsupported") {
    if (isIOS() && !isStandalone()) {
      return (
        <div className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
          To get notifications on iPhone, tap <strong>Share → Add to Home Screen</strong>, then open ZeroSync from your home screen and enable notifications.
        </div>
      );
    }
    return (
      <div className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
        Push notifications aren't available here. Open the app at{" "}
        <strong>zerosync.pages.dev</strong> (or install it to your home screen), then try again — the Lovable preview disables service workers.
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
        Notifications are blocked. Enable them in your browser/site settings, then reload.
      </div>
    );
  }

  if (state === "server-off") {
    return (
      <div className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
        {statusText ?? "Notification delivery is not configured yet."}
      </div>
    );
  }

  if (state === "on") {
    return (
      <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        <Button size="sm" variant="outline" onClick={disable} className="w-full gap-2 sm:w-auto">
          <BellOff className="h-4 w-4" /> Disable notifications
        </Button>
        <Button size="sm" variant="ghost" onClick={sendTest} className="w-full gap-2 sm:w-auto">
          <BellRing className="h-4 w-4" /> Send test
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {statusText && <p className="text-xs text-muted-foreground">{statusText}</p>}
      <Button size="sm" onClick={enable} className="w-full gap-2 sm:w-auto">
        <Bell className="h-4 w-4" /> Enable notifications
      </Button>
    </div>
  );
}
