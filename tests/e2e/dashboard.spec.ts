import { expect, test } from "@playwright/test";

test.describe("Dashboard", () => {
  test("carrega indicadores, gráficos, funil e tabela", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard comercial" })).toBeVisible();

    const indicators = page.getByRole("region", { name: "Indicadores" });
    for (const label of ["Total de leads", "Oportunidades abertas", "Valor em negociação", "Vendas concluídas", "Taxa de conversão"]) {
      await expect(indicators.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(indicators.getByText(/R\$/).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Vendas ganhas por mês" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Funil de vendas" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Leads e oportunidades" }).getByRole("table")).toBeVisible();
  });

  test("filtro de etapa recalcula a tela e marca indicadores não aplicáveis", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Etapa da negociação" }).click();
    await page.getByRole("option", { name: "Negociação" }).click();

    await expect(page).toHaveURL(/stage=negociacao/);
    await expect(page.getByText("Não se aplica à etapa filtrada").first()).toBeVisible();
    // Toda linha da tabela de oportunidades passa a estar na etapa filtrada.
    const rows = page.getByRole("region", { name: "Leads e oportunidades" }).getByRole("table").locator("tbody tr");
    await expect(page.getByText(/11 oportunidades no recorte|oportunidades no recorte/).first()).toBeVisible();
    await expect
      .poll(async () => {
        const total = await rows.count();
        const inStage = await rows.filter({ hasText: "Negociação" }).count();
        return total > 0 && total === inStage;
      })
      .toBe(true);
  });

  test("período sem dados mostra empty state explicativo e permite limpar", async ({ page }) => {
    await page.goto("/?start=2000-01-01&end=2000-12-31");
    await expect(page.getByText("Nenhuma oportunidade neste recorte")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.getByRole("region", { name: "Indicadores" })).toBeVisible();
  });

  test("busca na tabela filtra por empresa, mesmo sem acento", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: /Buscar/ }).fill("otica visao");
    await expect(page).toHaveURL(/q=otica/);
    const table = page.getByRole("region", { name: "Leads e oportunidades" }).getByRole("table");
    await expect(table.getByText("Ótica Visão Clara").first()).toBeVisible();
    await expect.poll(async () => (await table.locator("tbody tr").allInnerTexts()).every((t) => t.includes("Ótica Visão Clara"))).toBe(true);
  });
});
