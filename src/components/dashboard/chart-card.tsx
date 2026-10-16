import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Subconjunto das props que o Recharts passa para um tooltip customizado. */
export interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col rounded-xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 id={headingId} className="text-base font-semibold">
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
