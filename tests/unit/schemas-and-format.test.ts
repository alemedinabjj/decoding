import { describe, expect, it } from "vitest";
import { filterParamsSchema, opportunityQuerySchema } from "@/shared/schemas";
import { formatBRL, formatMonthLabel, formatPercent } from "@/shared/format";
import { monthRange } from "@/server/services/dashboard-service";

describe("filterParamsSchema", () => {
  it("converte strings vazias em ausentes e números de query string", () => {
    expect(filterParamsSchema.parse({ startDate: "", stage: "", salesRepId: "3" })).toEqual({ salesRepId: 3 });
  });

  it("rejeita etapa inexistente", () => {
    expect(() => filterParamsSchema.parse({ stage: "fechado" })).toThrow();
  });

  it("rejeita período invertido", () => {
    expect(() => filterParamsSchema.parse({ startDate: "2026-10-10", endDate: "2026-01-01" })).toThrow();
  });

  it("rejeita data em formato errado", () => {
    expect(() => filterParamsSchema.parse({ startDate: "10/10/2026" })).toThrow();
  });
});

describe("opportunityQuerySchema", () => {
  it("aceita ordenação, paginação e flags", () => {
    expect(
      opportunityQuerySchema.parse({ sort: "valueCents", direction: "asc", page: "2", pageSize: "20", staleOnly: "true" }),
    ).toEqual({ sort: "valueCents", direction: "asc", page: 2, pageSize: 20, staleOnly: true });
  });

  it("limita o tamanho de página", () => {
    expect(() => opportunityQuerySchema.parse({ pageSize: "500" })).toThrow();
  });
});

describe("format", () => {
  it("formata centavos em BRL", () => {
    expect(formatBRL(123456789).replace(/\s/g, " ")).toBe("R$ 1.234.567,89");
  });

  it("formata percentuais e trata ausência", () => {
    expect(formatPercent(57.14)).toBe("57,1%");
    expect(formatPercent(null)).toBe("—");
  });

  it("gera rótulos curtos de mês", () => {
    expect(formatMonthLabel("2026-10")).toBe("out/26");
  });
});

describe("monthRange", () => {
  it("gera meses contínuos atravessando a virada de ano", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("retorna vazio para intervalo invertido", () => {
    expect(monthRange("2026-03", "2026-01")).toEqual([]);
  });
});
