import type { ReactNode } from "react";
import { AlertTriangle, RotateCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Erro em um bloco da tela: mensagem clara e ação de tentar novamente. */
export function ErrorState({
  message,
  onRetry,
  compact = false,
  className,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "py-6" : "py-10",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">Algo deu errado</p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RotateCw className="size-3.5" /> Tentar novamente
        </Button>
      )}
    </div>
  );
}

/** Ausência de dados explicada — nunca um bloco vazio ou zeros sem contexto. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-10 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <SearchX className="size-5" />}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
