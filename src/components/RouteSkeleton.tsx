// Lightweight skeleton shown during route transitions when a loader is
// still resolving and there's no cached data yet. Kept generic so it works
// for every page without looking obviously wrong on any.
export function RouteSkeleton() {
  return (
    <div className="flex flex-col min-h-dvh bg-background" aria-hidden="true">
      {/* Simulated mobile header — matches the real header height + safe-area
          so the skeleton never bleeds into the Android / iOS status bar */}
      <div
        className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/40 bg-card/80 animate-pulse"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.5rem)' }}
      >
        <div className="h-6 w-6 rounded bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
      </div>

      {/* Page content skeleton */}
      <div className="flex-1 space-y-4 p-4 animate-pulse">
        <div className="h-7 w-40 max-w-[60%] rounded-md bg-muted" />
        <div className="h-4 w-64 max-w-[80%] rounded bg-muted/70" />
        <div className="mt-4 space-y-2">
          <div className="h-16 w-full rounded-xl bg-muted/60" />
          <div className="h-16 w-full rounded-xl bg-muted/60" />
          <div className="h-16 w-full rounded-xl bg-muted/60" />
        </div>
      </div>
    </div>
  );
}
