import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Compact Card variant with tight, consistent header padding and a min-w-0
 * content area so long values never push the layout. Use in place of raw
 * Card+CardHeader+CardContent when you need the same rhythm across sections.
 */
export function SectionCard({
  title,
  description,
  right,
  className,
  contentClassName,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn("shadow-none", className)}>
      {(title || description || right) && (
        <CardHeader className="flex-col items-stretch gap-2 space-y-0 px-4 sm:px-5 py-3 sm:py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            {title ? <CardTitle className="text-sm sm:text-base">{title}</CardTitle> : null}
            {description ? (
              <CardDescription className="text-xs sm:text-[13px] mt-0.5">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {right ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">
              {right}
            </div>
          ) : null}
        </CardHeader>
      )}

      <CardContent
        className={cn("min-w-0 px-4 sm:px-5 pb-4 sm:pb-5 pt-0", contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  );
}
