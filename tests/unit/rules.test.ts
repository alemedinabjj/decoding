import { describe, expect, it } from "vitest";
import {
  conversionRate,
  daysBetween,
  isStale,
  metricApplicability,
  riskIndex,
  riskLevel,
  staleCutoff,
  STALE_AFTER_DAYS,
} from "@/shared/rules";

const NOW = new Date("2026-10-16T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe("conversionRate", () => {
  it("calcula ganhos / (ganhos + perdidos) × 100", () => {
    expect(conversionRate(3, 1)).toBe(75);
    expect(conversionRate(1, 2)).toBeCloseTo(33.333, 2);
  });

  it("retorna null quando não há negociações encerradas (evita 0% enganoso)", () => {
    expect(conversionRate(0, 0)).toBeNull();
  });

  it("aceita 0% e 100% quando há encerradas", () => {
    expect(conversionRate(0, 4)).toBe(0);
    expect(conversionRate(5, 0)).toBe(100);
  });
});

describe("isStale", () => {
  it(`marca como parada a oportunidade aberta sem atualização há mais de ${STALE_AFTER_DAYS} dias`, () => {
    expect(isStale("negociacao", daysAgo(8), NOW)).toBe(true);
    expect(isStale("novo_contato", daysAgo(30), NOW)).toBe(true);
  });

  it("não marca oportunidades atualizadas dentro do prazo", () => {
    expect(isStale("qualificacao", daysAgo(6), NOW)).toBe(false);
    expect(isStale("qualificacao", daysAgo(STALE_AFTER_DAYS), NOW)).toBe(false);
  });

  it("nunca marca oportunidades encerradas, mesmo antigas", () => {
    expect(isStale("ganho", daysAgo(90), NOW)).toBe(false);
    expect(isStale("perdido", daysAgo(90), NOW)).toBe(false);
  });

  it("usa exatamente 7 dias como limite", () => {
    expect(staleCutoff(NOW).toISOString()).toBe("2026-10-09T12:00:00.000Z");
  });
});

describe("riskIndex", () => {
  it("é a fração do valor em negociação que está parada", () => {
    expect(riskIndex(25_000, 100_000)).toBe(25);
  });

  it("retorna null sem valor em negociação", () => {
    expect(riskIndex(0, 0)).toBeNull();
  });

  it("classifica em faixas saudável / atenção / crítico", () => {
    expect(riskLevel(10)).toBe("healthy");
    expect(riskLevel(20)).toBe("attention");
    expect(riskLevel(39.9)).toBe("attention");
    expect(riskLevel(40)).toBe("critical");
  });
});

describe("metricApplicability", () => {
  it("sem filtro de etapa, todos os indicadores se aplicam", () => {
    expect(metricApplicability(undefined)).toEqual({ open: true, closed: true });
  });

  it("etapa aberta desabilita indicadores de encerradas", () => {
    expect(metricApplicability("negociacao")).toEqual({ open: true, closed: false });
  });

  it("etapa encerrada desabilita indicadores de abertas", () => {
    expect(metricApplicability("ganho")).toEqual({ open: false, closed: true });
  });
});

describe("daysBetween", () => {
  it("conta dias inteiros e nunca é negativo", () => {
    expect(daysBetween(daysAgo(3), NOW)).toBe(3);
    expect(daysBetween(NOW, daysAgo(3))).toBe(0);
  });
});
