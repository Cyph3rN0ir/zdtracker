import { CloudOff } from "lucide-react";

export function OfflineDataUnavailable({ label = "data" }: { label?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
      <CloudOff className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">This {label} isn’t saved offline yet</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Reconnect once and keep ZeroSync open until syncing finishes. Your existing online data is
        unchanged.
      </p>
    </div>
  );
}
