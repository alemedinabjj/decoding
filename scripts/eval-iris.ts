/**
 * Avaliação da Iris com o LLM real: faz as perguntas obrigatórias do case e
 * confere se os números da resposta batem com os services do dashboard.
 *
 * Uso: npm run eval:iris   (requer OPENAI_API_KEY e banco populado)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import OpenAI from "openai";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { runIris } from "../src/server/iris/agent";
import { buildSystemPrompt } from "../src/server/iris/prompt";
import { findDataCoverage } from "../src/server/repositories/lead-repository";
import { getDashboardMetrics } from "../src/server/services/dashboard-service";
import { listOpportunities, listStaleOpportunities } from "../src/server/services/opportunity-service";
import { formatBRL } from "../src/shared/format";

interface EvalCase {
  question: string;
  /** Trechos que precisam aparecer na resposta. */
  expect: string[];
  /** Trechos que não podem aparecer (ex.: números inventados). */
  forbid?: RegExp[];
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const client = new OpenAI({ apiKey });
  const now = new Date();

  const [metrics, top3, stale, coverage, negotiation] = await Promise.all([
    getDashboardMetrics(db, {}, now),
    listOpportunities(db, { status: "open", sort: "valueCents", direction: "desc", pageSize: 3 }, now),
    listStaleOpportunities(db, {}, now),
    findDataCoverage(db),
    getDashboardMetrics(db, { stage: "negociacao" }, now),
  ]);

  const cases: EvalCase[] = [
    { question: "Quantas oportunidades estão em negociação?", expect: [String(negotiation.totalOpportunities)] },
    { question: "Qual o valor total das oportunidades abertas?", expect: [formatBRL(metrics.openValueCents)] },
    {
      question: "Quais são as 3 maiores oportunidades abertas?",
      expect: top3.items.flatMap((o) => [o.lead.companyName, formatBRL(o.valueCents)]),
    },
    {
      question: "Quais negociações precisam de atenção?",
      expect: stale.items.flatMap((o) => [o.lead.companyName, formatBRL(o.valueCents), o.salesRep.name]),
    },
    { question: "Qual foi a receita de 2018?", expect: ["2018"], forbid: [/R\$\s?\d/] },
  ];

  let failures = 0;
  for (const testCase of cases) {
    let answer = "";
    await runIris({
      client,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      systemPrompt: buildSystemPrompt({ now, coverage }),
      messages: [{ role: "user", content: testCase.question }],
      toolContext: { db, now },
      emit: (event) => {
        if (event.type === "delta") answer += event.text;
      },
    });
    const normalized = answer.replace(/ /g, " ");
    const missing = testCase.expect.filter((snippet) => !normalized.includes(snippet.replace(/ /g, " ")));
    const forbidden = (testCase.forbid ?? []).filter((pattern) => pattern.test(normalized));
    const ok = missing.length === 0 && forbidden.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${testCase.question}`);
    if (missing.length) console.log(`   faltando: ${missing.join(" | ")}`);
    if (forbidden.length) console.log(`   proibido encontrado: ${forbidden.join(", ")}`);
  }

  await pool.end();
  console.log(`\n${cases.length - failures}/${cases.length} perguntas com números idênticos ao dashboard.`);
  process.exit(failures ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
