import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Soft, dashed empty placeholder. Used across Tasks, Notebook, Chat, Personal,
 * Businesses so empty surfaces share one shape.
 */
export function EmptyState({
  message,
  hint,
  icon,
  action,
  className,
}: {
  message: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {icon ? (
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="text-foreground/80 [overflow-wrap:anywhere]">{message}</div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {hint}
        </div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
