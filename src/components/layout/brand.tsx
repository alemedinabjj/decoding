import { cn } from "@/lib/utils";

export function Brand({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground"
      >
        D
      </span>
      {!collapsed && (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white">Decoding</span>
          <span className="text-[11px] tracking-wide text-sidebar-foreground/80 uppercase">CRM comercial</span>
        </span>
      )}
    </div>
  );
}
