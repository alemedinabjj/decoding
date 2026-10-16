import { CheckCircle2, CircleDot, FileText, Handshake, Search, XCircle, type LucideIcon } from "lucide-react";
import { STAGE_LABELS, type Stage } from "@/shared/stages";
import { cn } from "@/lib/utils";

/**
 * Cada etapa tem cor, ícone e rótulo — a identidade nunca depende só da cor
 * (acessibilidade para daltonismo e impressão).
 */
const STAGE_STYLES: Record<Stage, { icon: LucideIcon; className: string }> = {
  novo_contato: {
    icon: CircleDot,
    className: "bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/30",
  },
  qualificacao: {
    icon: Search,
    className: "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/30",
  },
  proposta_enviada: {
    icon: FileText,
    className: "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/30",
  },
  negociacao: {
    icon: Handshake,
    className: "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/30",
  },
  ganho: {
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30",
  },
  perdido: {
    icon: XCircle,
    className: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/30",
  },
};

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  const { icon: Icon, className: styles } = STAGE_STYLES[stage];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        styles,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {STAGE_LABELS[stage]}
    </span>
  );
}

export function StageIcon({ stage, className }: { stage: Stage; className?: string }) {
  const Icon = STAGE_STYLES[stage].icon;
  return <Icon aria-hidden className={className} />;
}
