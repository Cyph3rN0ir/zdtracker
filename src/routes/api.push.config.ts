import { createFileRoute } from "@tanstack/react-router";
import { VAPID_PUBLIC_KEY as FALLBACK_PUBLIC_KEY } from "@/lib/push-config";

export const Route = createFileRoute("/api/push/config")({
  server: {
    handlers: {
      GET: async () => {
        const envPublic =
          process.env.ZEROSYNC_VAPID_PUBLIC_KEY ??
          process.env.VAPID_PUBLIC_KEY ??
          process.env.WEB_PUSH_PUBLIC_KEY ??
          null;
        const envPrivate =
          process.env.ZEROSYNC_VAPID_PRIVATE_KEY ??
          process.env.VAPID_PRIVATE_KEY ??
          process.env.WEB_PUSH_PRIVATE_KEY ??
          null;
        const subject =
          process.env.ZEROSYNC_VAPID_SUBJECT ??
          process.env.VAPID_SUBJECT ??
          process.env.WEB_PUSH_SUBJECT ??
          "mailto:admin@zerosync.app";

        // The public key is safe to ship — fall back to the bundled constant
        // so clients can still subscribe even if only the private signing key
        // is configured as a runtime secret.
        const publicKey = envPublic ?? FALLBACK_PUBLIC_KEY;
        const missing = [
          !envPrivate ? "ZEROSYNC_VAPID_PRIVATE_KEY" : null,
        ].filter(Boolean) as string[];

        return Response.json(
          {
            // Only "configured" when the server can actually sign + send.
            configured: Boolean(publicKey && envPrivate),
            publicKey,
            subject,
            missing,
          },
          { headers: { "cache-control": "no-store, max-age=0" } },
        );
      },
    },
  },
});