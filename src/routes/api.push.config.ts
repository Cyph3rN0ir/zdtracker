import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/push/config")({
  server: {
    handlers: {
      GET: async () => {
        const publicKey =
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
        const missing = [
          !publicKey ? "ZEROSYNC_VAPID_PUBLIC_KEY" : null,
          !privateKey ? "ZEROSYNC_VAPID_PRIVATE_KEY" : null,
        ].filter(Boolean) as string[];

        return Response.json(
          {
            configured: missing.length === 0,
            publicKey,
            subject,
            missing,
          },
          {
            headers: {
              "cache-control": "no-store, max-age=0",
            },
          },
        );
      },
    },
  },
});