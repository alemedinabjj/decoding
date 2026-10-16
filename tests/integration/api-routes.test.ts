/**
 * Integração dos route handlers com o banco real: contrato HTTP, validação e
 * tratamento de erros. Chama os handlers diretamente (sem subir servidor).
 */
import { describe, expect, it } from "vitest";
import { GET as getMetrics } from "@/app/api/dashboard/metrics/route";
import { GET as getFunnel } from "@/app/api/dashboard/funnel/route";
import { GET as getMonthlyWins } from "@/app/api/dashboard/monthly-wins/route";
import { GET as getOpportunities } from "@/app/api/opportunities/route";
import { POST as postChat } from "@/app/api/chat/route";
import type { DashboardMetrics, FunnelStage, MonthlyWins, Opportunity, Paginated } from "@/shared/types";
import { hasDatabase } from "./helpers";

const get = (path: string) => new Request(`http://localhost${path}`);

describe.skipIf(!hasDatabase)("rotas da API", () => {
  it("GET /api/dashboard/metrics devolve os indicadores", async () => {
    const response = await getMetrics(get("/api/dashboard/metrics"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as DashboardMetrics;
    expect(body.totalOpportunities).toBeGreaterThan(0);
    expect(body).toHaveProperty("conversionRate");
    expect(body.applicability).toEqual({ open: true, closed: true });
  });

  it("valida parâmetros e responde 400 com mensagem em português", async () => {
    const response = await getMetrics(get("/api/dashboard/metrics?startDate=2026-12-01&endDate=2026-01-01"));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid_params");
    expect(body.error.message).toMatch(/data inicial/i);
  });

  it("GET /api/dashboard/funnel sempre devolve as 6 etapas na ordem do funil", async () => {
    const body = (await (await getFunnel(get("/api/dashboard/funnel?stage=ganho"))).json()) as FunnelStage[];
    expect(body.map((s) => s.stage)).toEqual(["novo_contato", "qualificacao", "proposta_enviada", "negociacao", "ganho", "perdido"]);
    expect(body.filter((s) => s.stage !== "ganho").every((s) => s.count === 0)).toBe(true);
  });

  it("GET /api/dashboard/monthly-wins preenche meses contínuos a partir do início do período", async () => {
    const body = (await (await getMonthlyWins(get("/api/dashboard/monthly-wins?startDate=2026-01-01&endDate=2026-06-30"))).json()) as MonthlyWins[];
    const months = body.map((m) => m.month);
    // Oportunidades criadas até junho podem fechar depois: o eixo se estende até o último fechamento.
    expect(months.slice(0, 6)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
    months.forEach((month, i) => {
      if (i === 0) return;
      const [y, m] = months[i - 1].split("-").map(Number);
      expect(month).toBe(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`);
    });
  });

  it("GET /api/opportunities pagina e ordena no servidor", async () => {
    const page1 = (await (await getOpportunities(get("/api/opportunities?pageSize=5&sort=valueCents&direction=desc"))).json()) as Paginated<Opportunity>;
    const page2 = (await (await getOpportunities(get("/api/opportunities?pageSize=5&page=2&sort=valueCents&direction=desc"))).json()) as Paginated<Opportunity>;
    expect(page1.items).toHaveLength(5);
    expect(page1.totalPages).toBe(Math.ceil(page1.total / 5));
    expect(page1.items.at(-1)!.valueCents).toBeGreaterThanOrEqual(page2.items[0].valueCents);
    expect(new Set([...page1.items, ...page2.items].map((o) => o.id)).size).toBe(10);
  });

  it("POST /api/chat rejeita corpo inválido antes de chamar a IA", async () => {
    const response = await postChat(
      new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ messages: [] }) }),
    );
    expect([400, 503]).toContain(response.status);
  });
});
