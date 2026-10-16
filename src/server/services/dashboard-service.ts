/**
 * Indicadores do dashboard. Fonte única de verdade: as rotas da API e as
 * ferramentas da Iris chamam estas mesmas funções.
 */
import {
  aggregateByStage,
  aggregateMetrics,
  aggregateWinsByMonth,
  countLeadsInBase,
  earliestCreatedMonth,
  type Db,
} from "../repositories/opportunity-repository";
import { conversionRate, metricApplicability, riskIndex } from "../../shared/rules";
import { STAGES, STAGE_LABELS } from "../../shared/stages";
import { formatMonthLabel } from "../../shared/format";
import { APP_TIMEZONE, type DashboardMetrics, type FilterParams, type FunnelStage, type MonthlyWins } from "../../shared/types";

export async function getDashboardMetrics(db: Db, filters: FilterParams, now: Date): Promise<DashboardMetrics> {
  const [aggregate, totalLeadsInBase] = await Promise.all([aggregateMetrics(db, filters, now), countLeadsInBase(db)]);

  return {
    ...aggregate,
    totalLeadsInBase,
    conversionRate: conversionRate(aggregate.wonCount, aggregate.lostCount),
    riskIndex: riskIndex(aggregate.staleValueCents, aggregate.openValueCents),
    applicability: metricApplicability(filters.stage),
    referenceDate: now.toISOString(),
  };
}

/** Sempre devolve as 6 etapas, na ordem do funil, mesmo as que estão zeradas. */
export async function getFunnel(db: Db, filters: FilterParams): Promise<FunnelStage[]> {
  const rows = await aggregateByStage(db, filters);
  const byStage = new Map(rows.map((row) => [row.stage, row]));
  return STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: byStage.get(stage)?.count ?? 0,
    valueCents: byStage.get(stage)?.valueCents ?? 0,
  }));
}

function monthKeyInTimezone(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
}

/** Lista contínua de meses entre `from` e `to` (inclusive), no formato YYYY-MM. */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to && months.length < 240; month = nextMonth(month)) {
    months.push(month);
  }
  return months;
}

/**
 * Evolução mensal de oportunidades ganhas (pelo mês de fechamento).
 * Preenche meses sem vendas com zero para o gráfico não "pular" meses.
 */
export async function getMonthlyWins(db: Db, filters: FilterParams, now: Date): Promise<MonthlyWins[]> {
  const [rows, earliest] = await Promise.all([aggregateWinsByMonth(db, filters), earliestCreatedMonth(db, filters)]);
  if (!earliest && rows.length === 0) return [];

  const currentMonth = monthKeyInTimezone(now);
  const start = filters.startDate?.slice(0, 7) ?? earliest ?? rows[0].month;
  const lastWin = rows.at(-1)?.month ?? start;
  const requestedEnd = filters.endDate?.slice(0, 7) ?? currentMonth;
  const latest = requestedEnd > lastWin ? requestedEnd : lastWin;
  const end = latest > currentMonth ? currentMonth : latest;

  const byMonth = new Map(rows.map((row) => [row.month, row]));
  return monthRange(start, end).map((month) => ({
    month,
    label: formatMonthLabel(month),
    wonCount: byMonth.get(month)?.wonCount ?? 0,
    wonValueCents: byMonth.get(month)?.wonValueCents ?? 0,
  }));
}
