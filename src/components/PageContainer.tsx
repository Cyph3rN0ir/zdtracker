import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page container — keeps horizontal rhythm consistent across routes.
 * Wraps content in a fade-in for a smoother route transition (no JS dep).
 */
export function PageContainer({
  className,
  children,
  size = "default",
  animate = true,
}: {
  className?: string;
  children: React.ReactNode;
  size?: "default" | "wide" | "narrow";
  animate?: boolean;
}) {
  const max =
    size === "wide" ? "max-w-6xl" : size === "narrow" ? "max-w-3xl" : "max-w-5xl";
  return (
    <div
      className={cn(
        "mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6",
        max,
        animate && "animate-fade-in",
        className,
      )}
    >
      {children}
    </div>
  );
}
