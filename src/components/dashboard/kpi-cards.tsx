"use client";

import type { ReactNode } from "react";
import { AlertOctagon, AlertTriangle, BadgeCheck, Briefcase, CircleDollarSign, Info, Percent, ShieldCheck, Trophy, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatBRL, formatBRLCompact, formatInteger, formatPercent } from "@/shared/format";
import { riskLevel, RISK_THRESHOLDS, STALE_AFTER_DAYS, type RiskLevel } from "@/shared/rules";
import type { DashboardMetrics } from "@/shared/types";

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  footer?: ReactNode;
  notApplicable?: boolean;
  title?: string;
}

function KpiCard({ label, value, hint, icon, footer, notApplicable, title }: KpiCardProps) {
  return (
    <div className="flex min-h-[132px] flex-col justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <Tooltip>
            <TooltipTrigger
              render={
                <button type="button" className="rounded text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                  <Info className="size-3.5" />
                  <span className="sr-only">Como é calculado: {label}</span>
                </button>
              }
            />
            <TooltipContent className="max-w-64">{hint}</TooltipContent>
          </Tooltip>
        </div>
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">{icon}</span>
      </div>
      <div className="space-y-1">
        <p
          title={title}
          className={cn("text-2xl font-semibold tracking-tight tabular-nums", notApplicable && "text-muted-foreground")}
        >
          {notApplicable ? "—" : value}
        </p>
        <div className="min-h-5 text-xs text-muted-foreground">
          {notApplicable ? "Não se aplica à etapa filtrada" : footer}
        </div>
      </div>
    </div>
  );
}

const RISK_STYLES: Record<RiskLevel, { label: string; className: string; icon: ReactNode }> = {
  healthy: { label: "Saudável", className: "text-success", icon: <ShieldCheck className="size-3.5" /> },
  attention: { label: "Atenção", className: "text-warning", icon: <AlertTriangle className="size-3.5" /> },
  critical: { label: "Crítico", className: "text-danger", icon: <AlertOctagon className="size-3.5" /> },
};

export function KpiCards({ metrics }: { metrics: DashboardMetrics }) {
  const { applicability } = metrics;
  const risk = metrics.riskIndex === null ? null : riskLevel(metrics.riskIndex);

  return (
    <section aria-label="Indicadores" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <KpiCard
        label="Total de leads"
        value={formatInteger(metrics.totalLeads)}
        hint="Leads distintos com oportunidades no recorte filtrado. O total de leads cadastrados aparece abaixo."
        icon={<Users className="size-4" />}
        footer={`de ${formatInteger(metrics.totalLeadsInBase)} cadastrados na base`}
      />
      <KpiCard
        label="Oportunidades abertas"
        value={formatInteger(metrics.openOpportunities)}
        hint="Negociações em Novo contato, Qualificação, Proposta enviada ou Negociação."
        icon={<Briefcase className="size-4" />}
        notApplicable={!applicability.open}
        footer={
          metrics.staleCount > 0 ? (
            <span className="text-warning">
              {formatInteger(metrics.staleCount)} sem atualização há +{STALE_AFTER_DAYS} dias
            </span>
          ) : (
            "Nenhuma parada"
          )
        }
      />
      <KpiCard
        label="Valor em negociação"
        value={formatBRLCompact(metrics.openValueCents)}
        title={formatBRL(metrics.openValueCents)}
        hint="Soma dos valores estimados apenas das oportunidades abertas."
        icon={<CircleDollarSign className="size-4" />}
        notApplicable={!applicability.open}
        footer={formatBRL(metrics.openValueCents)}
      />
      <KpiCard
        label="Vendas concluídas"
        value={formatInteger(metrics.wonCount)}
        hint="Quantidade de oportunidades na etapa Ganho."
        icon={<Trophy className="size-4" />}
        notApplicable={!applicability.closed}
        footer={`${formatBRL(metrics.wonValueCents)} em vendas`}
      />
      <KpiCard
        label="Taxa de conversão"
        value={formatPercent(metrics.conversionRate)}
        hint="Ganhas ÷ (Ganhas + Perdidas) × 100. Sem negociações encerradas no recorte, exibimos “—”."
        icon={<Percent className="size-4" />}
        notApplicable={!applicability.closed}
        footer={
          metrics.conversionRate === null
            ? "Sem negociações encerradas no recorte"
            : `${formatInteger(metrics.wonCount)} ganhas · ${formatInteger(metrics.lostCount)} perdidas`
        }
      />
      <KpiCard
        label="Índice de risco"
        value={formatPercent(metrics.riskIndex)}
        hint={`Parte do valor em negociação parada há mais de ${STALE_AFTER_DAYS} dias. Faixas: saudável < ${RISK_THRESHOLDS.attention}%, atenção até ${RISK_THRESHOLDS.critical}%, crítico acima.`}
        icon={<BadgeCheck className="size-4" />}
        notApplicable={!applicability.open}
        footer={
          risk ? (
            <span className={cn("inline-flex items-center gap-1 font-medium", RISK_STYLES[risk].className)}>
              {RISK_STYLES[risk].icon}
              {RISK_STYLES[risk].label} · {formatBRLCompact(metrics.staleValueCents)} parados
            </span>
          ) : (
            "Sem valor em negociação"
          )
        }
      />
    </section>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando indicadores" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex min-h-[132px] flex-col justify-between rounded-xl border bg-card p-4">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}
