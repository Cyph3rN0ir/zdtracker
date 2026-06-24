// Lightweight skeleton shown during route transitions when a loader is
// still resolving and there's no cached data yet. Kept generic so it works
// for every page without looking obviously wrong on any.
export function RouteSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse" aria-hidden="true">
      <div className="h-7 w-40 max-w-[60%] rounded-md bg-muted" />
      <div className="h-4 w-64 max-w-[80%] rounded bg-muted/70" />
      <div className="mt-4 space-y-2">
        <div className="h-16 w-full rounded-xl bg-muted/60" />
        <div className="h-16 w-full rounded-xl bg-muted/60" />
        <div className="h-16 w-full rounded-xl bg-muted/60" />
      </div>
    </div>
  );
}
