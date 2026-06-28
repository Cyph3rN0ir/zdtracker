import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  removePushSubscriptionFn,
  savePushSubscriptionFn,
  sendTestPushFn,
} from "@/lib/push.functions";
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from "@/lib/push-config";

type State = "unsupported" | "blocked" | "off" | "on" | "loading";

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

export function EnablePushButton() {
  const [state, setState] = useState<State>("loading");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const save = useServerFn(savePushSubscriptionFn);
  const remove = useServerFn(removePushSubscriptionFn);
  const test = useServerFn(sendTestPushFn);

  async function refresh() {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
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

  async function enable() {
    setState("loading");
    try {
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setState(perm === "denied" ? "blocked" : "off");
          return;
        }
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
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
      setState("on");
      toast.success("Notifications enabled");
    } catch (e) {
      console.error("[push] enable failed", e);
      toast.error("Could not enable notifications");
      await refresh();
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
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
    try {
      await test();
      toast.success("Test notification sent");
    } catch {
      toast.error("Failed to send test");
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
      <div className="text-xs text-muted-foreground">Notifications aren't supported on this browser.</div>
    );
  }

  if (state === "blocked") {
    return (
      <div className="text-xs text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
        Notifications are blocked. Enable them in your browser/site settings, then reload.
      </div>
    );
  }

  if (state === "on") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={disable} className="gap-2">
          <BellOff className="h-4 w-4" /> Disable notifications
        </Button>
        <Button size="sm" variant="ghost" onClick={sendTest} className="gap-2">
          <BellRing className="h-4 w-4" /> Send test
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={enable} className="gap-2">
      <Bell className="h-4 w-4" /> Enable notifications
    </Button>
  );
}
