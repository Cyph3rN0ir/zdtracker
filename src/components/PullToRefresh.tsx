import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

// Touch-driven pull-to-refresh for the PWA shell.
// - Activates only when the scroll container is at the very top.
// - Triggers query invalidation + router refresh when pulled past THRESHOLD.
// - Inert on desktop (touch events only).
const THRESHOLD = 70;
const MAX_PULL = 120;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      // Only at the very top of the document.
      const top = window.scrollY || document.documentElement.scrollTop || 0;
      if (top > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (refreshing || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Resist past threshold.
      const eased = Math.min(MAX_PULL, dy * 0.5);
      setPull(eased);
    };
    const onTouchEnd = async () => {
      if (startY.current == null) return;
      const distance = pull;
      startY.current = null;
      if (distance >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await Promise.allSettled([qc.invalidateQueries(), router.invalidate()]);
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull, refreshing, qc, router]);

  return (
    <>
      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 grid place-items-center rounded-full bg-card border border-border shadow-md text-muted-foreground transition-opacity"
        style={{
          top: 8,
          width: 36,
          height: 36,
          transform: `translate(-50%, ${pull - 44}px)`,
          opacity: pull > 8 ? Math.min(1, pull / THRESHOLD) : 0,
          pointerEvents: "none",
        }}
        aria-hidden
      >
        <Loader2 className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </div>
      {children}
    </>
  );
}
