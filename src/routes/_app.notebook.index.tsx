import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/notebook/")({
  beforeLoad: () => {
    throw redirect({ to: "/notebook/today", search: {} });
  },
});
