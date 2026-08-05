// Lightweight skeleton shown during route transitions when a loader is
// still resolving and there's no cached data yet.
export function RouteSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col min-h-dvh animate-pulse"
      style={{ background: '#0F0F0F' }}
    >
      {/* Safe-area spacer — pushes content below the status bar.
          No fake header: just a clean dark screen with skeleton cards. */}
      <div style={{ height: 'max(env(safe-area-inset-top, 0px), 1rem)' }} />

      {/* Skeleton content */}
      <div className="flex-1 px-4 pt-4 space-y-3">
        {/* Title bar placeholder */}
        <div className="flex items-center justify-between mb-5">
          <div className="h-5 w-32 rounded-full" style={{ background: '#1e1e1e' }} />
          <div className="h-8 w-8 rounded-lg" style={{ background: '#1e1e1e' }} />
        </div>

        {/* Card skeletons */}
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="w-full rounded-xl"
            style={{
              height: '68px',
              background: '#161616',
              opacity: 1 - (i - 1) * 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
}
