import { CloudOff } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function OfflineDataUnavailable({ label = "data" }: { label?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
      <CloudOff className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">This {label} isn’t saved offline yet</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Reconnect, then use Download for offline use in Settings. Your existing online data is
        unchanged.
      </p>
      <Link
        to="/settings"
        className="mt-4 inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        Open Settings
      </Link>
    </div>
  );
}
