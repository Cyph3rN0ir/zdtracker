import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Standardized page heading. Wrap-safe on mobile (360px+), title truncates,
 * subtitle wraps with [overflow-wrap:anywhere] to survive long values, and
 * the right slot is reserved for primary actions (e.g. a "New" button).
 */
export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight truncate">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[13px] sm:text-sm text-muted-foreground mt-1 [overflow-wrap:anywhere]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
