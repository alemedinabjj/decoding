import { expect, test, type Page } from "@playwright/test";

/** O LLM é simulado: a rota /api/chat responde um stream SSE fixo (testes rápidos, sem custo). */
async function mockChat(page: Page, events: object[], status = 200) {
  await page.route("**/api/chat", async (route) => {
    if (status !== 200) {
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: { code: "x", message: "x" } }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    });
  });
}

test.describe("Iris", () => {
  test("envia pergunta, mostra a consulta realizada e a resposta", async ({ page }) => {
    await mockChat(page, [
      { type: "status", tool: "get_stale_opportunities", label: "Procurando oportunidades paradas" },
      { type: "delta", text: "Há **12 negociações** paradas. " },
      { type: "delta", text: "Recomendo priorizar as de maior valor." },
      { type: "done" },
    ]);
    await page.goto("/iris");
    await page.getByLabel("Mensagem para a Iris").fill("Quais negociações precisam de atenção?");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();

    await expect(page.getByText("Quais negociações precisam de atenção?")).toBeVisible();
    await expect(page.getByText("12 negociações")).toBeVisible();
    await expect(page.getByText(/Fontes consultadas: Procurando oportunidades paradas/)).toBeVisible();
  });

  test("trata limite de requisições com mensagem clara e opção de tentar de novo", async ({ page }) => {
    await mockChat(page, [], 429);
    await page.goto("/iris");
    await page.getByRole("button", { name: "Qual o valor total das oportunidades abertas?" }).click();
    await expect(page.getByRole("alert").getByText(/limite de perguntas/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });

  test("abre pelo painel lateral do dashboard", async ({ page }) => {
    await mockChat(page, [{ type: "delta", text: "Resposta do painel." }, { type: "done" }]);
    await page.goto("/");
    await page.getByRole("button", { name: "Perguntar à Iris" }).first().click();
    await page.getByRole("dialog").getByLabel("Mensagem para a Iris").fill("Resumo do pipeline");
    await page.getByRole("dialog").getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.getByRole("dialog").getByText("Resposta do painel.")).toBeVisible();
  });
});
