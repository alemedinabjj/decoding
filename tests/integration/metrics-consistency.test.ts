/**
 * Garante que os indicadores calculados em SQL batem com uma implementação de
 * referência ingênua em JavaScript, sobre os dados reais do banco, e que a
 * conexão somente leitura (Iris) devolve exatamente o mesmo resultado.
 *
 * Os testes são somente leitura e funcionam para qualquer base populada.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { leads, opportunities, salesReps } from "@/server/db/schema";
import type { Db } from "@/server/repositories/opportunity-repository";
import { getDashboardMetrics, getFunnel } from "@/server/services/dashboard-service";
import { listOpportunities, listStaleOpportunities } from "@/server/services/opportunity-service";
import { conversionRate, isStale } from "@/shared/rules";
import { isOpenStage, type Stage } from "@/shared/stages";
import type { FilterParams } from "@/shared/types";
import { closeAll, connect, hasDatabase } from "./helpers";

interface RawRow {
  stage: Stage;
  valueCents: number;
  createdAt: Date;
  updatedAt: Date;
  leadId: number;
  salesRepId: number;
  companyName: string;
}

const NOW = new Date();
const spMidnight = (date: string) => new Date(`${date}T00:00:00-03:00`);

function applyFilters(rows: RawRow[], f: FilterParams): RawRow[] {
  return rows.filter((r) => {
    if (f.startDate && r.createdAt < spMidnight(f.startDate)) return false;
    if (f.endDate && r.createdAt >= new Date(spMidnight(f.endDate).getTime() + 86_400_000)) return false;
    if (f.stage && r.stage !== f.stage) return false;
    if (f.salesRepId && r.salesRepId !== f.salesRepId) return false;
    return true;
  });
}

function referenceMetrics(rows: RawRow[]) {
  const open = rows.filter((r) => isOpenStage(r.stage));
  const stale = rows.filter((r) => isStale(r.stage, r.updatedAt, NOW));
  const won = rows.filter((r) => r.stage === "ganho").length;
  const lost = rows.filter((r) => r.stage === "perdido").length;
  const sum = (list: RawRow[]) => list.reduce((acc, r) => acc + r.valueCents, 0);
  return {
    totalOpportunities: rows.length,
    totalLeads: new Set(rows.map((r) => r.leadId)).size,
    openOpportunities: open.length,
    openValueCents: sum(open),
    wonCount: won,
    lostCount: lost,
    conversionRate: conversionRate(won, lost),
    staleCount: stale.length,
    staleValueCents: sum(stale),
  };
}

describe.skipIf(!hasDatabase)("consistência dos indicadores", () => {
  let db: Db;
  let readonlyDb: Db;
  let rows: RawRow[] = [];
  let firstRepId = 0;

  beforeAll(async () => {
    db = connect(process.env.DATABASE_URL);
    readonlyDb = connect(process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL);
    rows = await db
      .select({
        stage: opportunities.stage,
        valueCents: opportunities.valueCents,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
        leadId: opportunities.leadId,
        salesRepId: opportunities.salesRepId,
        companyName: leads.companyName,
      })
      .from(opportunities)
      .innerJoin(leads, eq(opportunities.leadId, leads.id));
    const [rep] = await db.select({ id: salesReps.id }).from(salesReps).limit(1);
    firstRepId = rep.id;
  });

  afterAll(closeAll);

  const scenarios = (): [string, FilterParams][] => {
    const ninetyDaysAgo = new Date(NOW.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
    return [
      ["sem filtros", {}],
      ["últimos 90 dias", { startDate: ninetyDaysAgo }],
      ["etapa Negociação", { stage: "negociacao" }],
      ["etapa Ganho", { stage: "ganho" }],
      ["por responsável", { salesRepId: firstRepId }],
      ["período sem dados", { startDate: "2000-01-01", endDate: "2000-12-31" }],
    ];
  };

  it("a base de teste tem dados", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each([0, 1, 2, 3, 4, 5])("cenário %i: SQL bate com a referência em JS", async (index) => {
    const [, filters] = scenarios()[index];
    const metrics = await getDashboardMetrics(db, filters, NOW);
    expect(metrics).toMatchObject(referenceMetrics(applyFilters(rows, filters)));
  });

  it.each([0, 1, 2, 3, 4, 5])("cenário %i: conexão da Iris devolve os mesmos números", async (index) => {
    const [, filters] = scenarios()[index];
    const [fromDashboard, fromIris] = await Promise.all([
      getDashboardMetrics(db, filters, NOW),
      getDashboardMetrics(readonlyDb, filters, NOW),
    ]);
    expect(fromIris).toEqual(fromDashboard);
  });

  it("o funil soma o total de oportunidades e cobre as 6 etapas", async () => {
    const [funnel, metrics] = await Promise.all([getFunnel(db, {}), getDashboardMetrics(db, {}, NOW)]);
    expect(funnel).toHaveLength(6);
    expect(funnel.reduce((acc, s) => acc + s.count, 0)).toBe(metrics.totalOpportunities);
  });

  it("a lista de paradas bate com o card e só contém abertas sem atualização há mais de 7 dias", async () => {
    const [stale, metrics] = await Promise.all([listStaleOpportunities(db, {}, NOW), getDashboardMetrics(db, {}, NOW)]);
    expect(stale.total).toBe(metrics.staleCount);
    expect(stale.items.every((o) => o.isStale && isOpenStage(o.stage) && o.daysSinceUpdate > 7)).toBe(true);
    const values = stale.items.map((o) => o.valueCents);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it("a soma das abertas na lista bate com o valor em negociação", async () => {
    const [open, metrics] = await Promise.all([
      listOpportunities(db, { status: "open", pageSize: 100 }, NOW),
      getDashboardMetrics(db, {}, NOW),
    ]);
    expect(open.total).toBe(metrics.openOpportunities);
    expect(open.items.reduce((acc, o) => acc + o.valueCents, 0)).toBe(metrics.openValueCents);
  });

  it("a busca encontra empresa ignorando acentos e caixa", async () => {
    const target = rows[0].companyName;
    const query = target.slice(0, 5).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const result = await listOpportunities(db, { search: query, pageSize: 100 }, NOW);
    expect(result.items.some((o) => o.lead.companyName === target)).toBe(true);
  });
});
