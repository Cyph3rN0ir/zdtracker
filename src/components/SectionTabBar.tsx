import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Navigation for dense workspaces such as Business and Personal.
 * Phones get a fully visible four-column grid; larger screens use one row.
 */
export function SectionTabBar({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card/80 p-1.5 shadow-sm supports-[backdrop-filter]:bg-card/70 supports-[backdrop-filter]:backdrop-blur-xl",
        className,
      )}
    >
      <TabsList
        aria-label={label}
        className="grid h-auto w-full grid-cols-4 gap-1 rounded-xl bg-transparent p-0 lg:inline-flex lg:w-auto lg:flex-nowrap"
      >
        {children}
      </TabsList>
    </div>
  );
}

const triggerClass = cn(
  "tap min-h-12 min-w-0 w-full flex-col gap-1 rounded-xl px-1 py-2 text-[10px] leading-none shadow-none",
  "lg:min-h-9 lg:w-auto lg:flex-row lg:gap-2 lg:px-3 lg:py-1.5 lg:text-sm",
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
  "data-[state=inactive]:hover:bg-accent/70 data-[state=inactive]:hover:text-accent-foreground",
);

export function SectionTabTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsTrigger>) {
  return <TabsTrigger className={cn(triggerClass, className)} {...props} />;
}

export function SectionTabLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <>
      <span className="grid h-4 w-4 shrink-0 place-items-center" aria-hidden="true">
        {icon}
      </span>
      <span className="max-w-full truncate">{children}</span>
    </>
  );
}
