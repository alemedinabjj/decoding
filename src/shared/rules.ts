/**
 * Regras de negócio puras (sem I/O). Compartilhadas por services, UI e Iris,
 * garantindo que todos calculem os indicadores da mesma forma.
 */
import { isClosedStage, isOpenStage, type Stage } from "./stages";
import type { MetricApplicability } from "./types";

/** Oportunidade aberta sem atualização há mais de N dias é considerada "parada". */
export const STALE_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Instante a partir do qual uma oportunidade aberta passa a ser "parada". */
export function staleCutoff(now: Date): Date {
  return new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

export function isStale(stage: Stage, updatedAt: Date, now: Date): boolean {
  return isOpenStage(stage) && updatedAt.getTime() < staleCutoff(now).getTime();
}

/**
 * Taxa de conversão = Ganhos / (Ganhos + Perdidos) × 100.
 * Retorna `null` quando não há negociações encerradas — exibir 0% seria enganoso.
 */
export function conversionRate(won: number, lost: number): number | null {
  const closed = won + lost;
  if (closed === 0) return null;
  return (won / closed) * 100;
}

/**
 * Índice de risco do pipeline = valor parado / valor em negociação × 100.
 * Retorna `null` quando não há valor em negociação.
 */
export function riskIndex(staleValueCents: number, openValueCents: number): number | null {
  if (openValueCents <= 0) return null;
  return (staleValueCents / openValueCents) * 100;
}

export type RiskLevel = "healthy" | "attention" | "critical";

export const RISK_THRESHOLDS = { attention: 20, critical: 40 } as const;

export function riskLevel(index: number): RiskLevel {
  if (index >= RISK_THRESHOLDS.critical) return "critical";
  if (index >= RISK_THRESHOLDS.attention) return "attention";
  return "healthy";
}

/**
 * Com filtro de etapa aberta, indicadores de encerradas não se aplicam (e vice-versa).
 * Evita mostrar "0 vendas" quando o usuário filtrou apenas "Negociação".
 */
export function metricApplicability(stage: Stage | undefined): MetricApplicability {
  if (!stage) return { open: true, closed: true };
  return { open: isOpenStage(stage), closed: isClosedStage(stage) };
}
