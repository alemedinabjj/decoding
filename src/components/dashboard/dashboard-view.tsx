"use client";

import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { CalendarSearch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { dashboardKeys, useFunnel, useMetrics, useMonthlyWins } from "@/hooks/use-dashboard-data";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { formatDate } from "@/shared/format";
import { STAGE_LABELS } from "@/shared/stages";
import type { FilterParams } from "@/shared/types";
import { FiltersBar } from "./filters-bar";
import { FunnelChart } from "./funnel-chart";
import { KpiCards, KpiCardsSkeleton } from "./kpi-cards";
import { MonthlyWinsChart } from "./monthly-wins-chart";
import { OpportunitiesTable } from "./opportunities-table";
import { StageValueChart } from "./stage-value-chart";

function describePeriod(filters: FilterParams): string {
  if (filters.startDate && filters.endDate) return `de ${formatDate(`${filters.startDate}T12:00:00`)} a ${formatDate(`${filters.endDate}T12:00:00`)}`;
  if (filters.startDate) return `a partir de ${formatDate(`${filters.startDate}T12:00:00`)}`;
  if (filters.endDate) return `até ${formatDate(`${filters.endDate}T12:00:00`)}`;
  return "em todo o período";
}

export function DashboardView() {
  const { filters, clearFilters } = useDashboardFilters();
  // A busca textual é exclusiva da tabela; indicadores e gráficos usam os demais filtros.
  const chartFilters: FilterParams = { ...filters, search: undefined };

  const metrics = useMetrics(chartFilters);
  const funnel = useFunnel(chartFilters);
  const monthlyWins = useMonthlyWins(chartFilters);
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: dashboardKeys.all }) > 0;

  const isEmpty = metrics.data?.totalOpportunities === 0;
  const periodText = describePeriod(chartFilters);
  const stageText = chartFilters.stage ? ` · etapa ${STAGE_LABELS[chartFilters.stage]}` : "";

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard comercial</h1>
          <p className="text-sm text-muted-foreground">
            Oportunidades criadas {periodText}
            {stageText}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })}
          disabled={fetching}
          className="gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={fetching ? "animate-spin" : undefined} />
          {fetching ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      <FiltersBar />

      {metrics.error && !metrics.data ? (
        <div className="rounded-xl border bg-card">
          <ErrorState message={metrics.error.message} onRetry={() => void metrics.refetch()} />
        </div>
      ) : isEmpty ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={<CalendarSearch className="size-5" />}
            title="Nenhuma oportunidade neste recorte"
            description={`Não há oportunidades criadas ${periodText}${stageText} com os filtros selecionados. Amplie o período ou remova algum filtro.`}
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {metrics.data ? <KpiCards metrics={metrics.data} /> : <KpiCardsSkeleton />}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <div className="grid xl:col-span-3">
              <MonthlyWinsChart
                data={monthlyWins.data}
                isLoading={monthlyWins.isLoading}
                error={monthlyWins.error}
                onRetry={() => void monthlyWins.refetch()}
                notApplicable={metrics.data ? !metrics.data.applicability.closed : false}
              />
            </div>
            <div className="xl:col-span-2">
              <FunnelChart data={funnel.data} isLoading={funnel.isLoading} error={funnel.error} onRetry={() => void funnel.refetch()} />
            </div>
          </div>

          <StageValueChart data={funnel.data} isLoading={funnel.isLoading} error={funnel.error} onRetry={() => void funnel.refetch()} />

          <OpportunitiesTable />
        </>
      )}
    </div>
  );
}
