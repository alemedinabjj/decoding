/**
 * Seed determinístico e relativo à data atual.
 *
 * - Mesma sequência pseudoaleatória a cada execução (PRNG com seed fixa).
 * - Datas calculadas a partir de "hoje": o demo nunca envelhece e sempre
 *   existem oportunidades abertas paradas há mais de 7 dias.
 * - Embeddings dos leads são gerados se OPENAI_API_KEY estiver configurada;
 *   sem a chave, a busca semântica degrada para trigram.
 *
 * Uso: npm run db:seed
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";
import { SEED_LEADS, SEED_PRODUCTS, SEED_SALES_REPS, STAGE_NOTES, type SeedLead } from "./seed-data";
import { OPEN_STAGES, type Stage } from "../../shared/stages";
import { STALE_AFTER_DAYS } from "../../shared/rules";

config({ path: ".env.local" });

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_OF_HISTORY = 12;
const MIN_STALE_OPEN = 10;

/** mulberry32 — PRNG pequeno e determinístico. */
function createRandom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20261016);
const randInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const chance = (p: number) => random() < p;

interface OpportunityDraft {
  leadId: number;
  salesRepId: number;
  name: string;
  valueCents: number;
  stage: Stage;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

function randomDateInMonth(now: Date, monthsAgo: number): Date {
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1, 9, 0, 0);
  const end = monthsAgo === 0 ? now : new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 18, 0, 0);
  return new Date(start.getTime() + random() * (end.getTime() - start.getTime()));
}

function pickOpenStage(ageDays: number): Stage {
  // Oportunidades mais antigas tendem a estar em etapas mais avançadas.
  if (ageDays < 10) return pick(["novo_contato", "novo_contato", "qualificacao"] as const);
  if (ageDays < 30) return pick(["qualificacao", "proposta_enviada", "novo_contato"] as const);
  return pick(["proposta_enviada", "negociacao", "negociacao", "qualificacao"] as const);
}

function decideStage(ageDays: number): Stage {
  const closeProbability = ageDays > 60 ? 0.85 : ageDays > 20 ? 0.45 : 0.1;
  if (chance(closeProbability)) return chance(0.55) ? "ganho" : "perdido";
  return pickOpenStage(ageDays);
}

function buildOpportunity(now: Date, leadId: number, salesRepId: number, createdAt: Date): OpportunityDraft {
  const product = pick(SEED_PRODUCTS);
  const valueReais = Math.round(randInt(product.minReais, product.maxReais) / 100) * 100;
  const ageDays = (now.getTime() - createdAt.getTime()) / DAY_MS;
  const stage = decideStage(ageDays);
  const notes = pick(STAGE_NOTES[stage]);

  let updatedAt: Date;
  let closedAt: Date | null = null;

  if (stage === "ganho" || stage === "perdido") {
    const closeTime = Math.min(createdAt.getTime() + randInt(7, 45) * DAY_MS, now.getTime() - DAY_MS);
    closedAt = new Date(Math.max(closeTime, createdAt.getTime() + 60 * 60 * 1000));
    updatedAt = closedAt;
  } else {
    const canBeStale = ageDays > STALE_AFTER_DAYS + 1;
    const daysSinceUpdate = canBeStale && chance(0.4) ? randInt(STALE_AFTER_DAYS + 1, 40) : randInt(0, STALE_AFTER_DAYS - 2);
    const candidate = now.getTime() - daysSinceUpdate * DAY_MS - randInt(0, 8) * 60 * 60 * 1000;
    updatedAt = new Date(Math.max(candidate, createdAt.getTime() + 60 * 60 * 1000));
  }

  return { leadId, salesRepId, name: product.name, valueCents: valueReais * 100, stage, notes, createdAt, updatedAt, closedAt };
}

function isStaleOpen(o: OpportunityDraft, now: Date) {
  return (OPEN_STAGES as readonly Stage[]).includes(o.stage) && now.getTime() - o.updatedAt.getTime() > STALE_AFTER_DAYS * DAY_MS;
}

/** Garante um mínimo de oportunidades paradas para a análise da Iris. */
function ensureStaleOpportunities(drafts: OpportunityDraft[], now: Date) {
  let staleCount = drafts.filter((o) => isStaleOpen(o, now)).length;
  for (const o of drafts) {
    if (staleCount >= MIN_STALE_OPEN) break;
    const isOpen = (OPEN_STAGES as readonly Stage[]).includes(o.stage);
    const ageDays = (now.getTime() - o.createdAt.getTime()) / DAY_MS;
    if (isOpen && !isStaleOpen(o, now) && ageDays > 20) {
      o.updatedAt = new Date(now.getTime() - randInt(STALE_AFTER_DAYS + 2, Math.min(30, Math.floor(ageDays) - 1)) * DAY_MS);
      staleCount++;
    }
  }
}

function leadEmbeddingText(lead: SeedLead) {
  return `${lead.companyName}. Segmento: ${lead.segment}. ${lead.description}`;
}

async function generateEmbeddings(texts: string[]): Promise<number[][] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("⚠ OPENAI_API_KEY ausente: leads serão criados sem embeddings (busca usa apenas trigram).");
    return null;
  }
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small", input: texts }),
  });
  if (!response.ok) {
    console.warn(`⚠ Falha ao gerar embeddings (${response.status}); seguindo sem eles.`);
    return null;
  }
  const json = (await response.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const now = new Date();

  console.log("→ Limpando tabelas...");
  await db.execute(sql`TRUNCATE opportunities, leads, sales_reps RESTART IDENTITY CASCADE`);

  console.log("→ Responsáveis comerciais...");
  const reps = await db
    .insert(schema.salesReps)
    .values(SEED_SALES_REPS.map((r) => ({ ...r, createdAt: new Date(now.getTime() - 400 * DAY_MS) })))
    .returning({ id: schema.salesReps.id });

  console.log("→ Leads...");
  const embeddings = await generateEmbeddings(SEED_LEADS.map(leadEmbeddingText));
  const leads = await db
    .insert(schema.leads)
    .values(
      SEED_LEADS.map((lead, i) => ({
        ...lead,
        email: `${lead.contactName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@exemplo.com.br`,
        embedding: embeddings?.[i] ?? null,
        createdAt: new Date(now.getTime() - randInt(370, 420) * DAY_MS),
      })),
    )
    .returning({ id: schema.leads.id, createdAt: schema.leads.createdAt });

  console.log("→ Oportunidades...");
  const drafts: OpportunityDraft[] = [];
  for (let monthsAgo = MONTHS_OF_HISTORY - 1; monthsAgo >= 0; monthsAgo--) {
    const perMonth = randInt(6, 8);
    for (let i = 0; i < perMonth; i++) {
      const lead = pick(leads);
      const rep = pick(reps);
      const createdAt = randomDateInMonth(now, monthsAgo);
      drafts.push(buildOpportunity(now, lead.id, rep.id, createdAt));
    }
  }
  ensureStaleOpportunities(drafts, now);
  await db.insert(schema.opportunities).values(drafts);

  const staleCount = drafts.filter((o) => isStaleOpen(o, now)).length;
  const byStage = drafts.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.stage]: (acc[o.stage] ?? 0) + 1 }), {});
  console.log(`✓ ${reps.length} responsáveis, ${leads.length} leads, ${drafts.length} oportunidades.`);
  console.log("  Por etapa:", byStage);
  console.log(`  Abertas sem atualização há mais de ${STALE_AFTER_DAYS} dias: ${staleCount}`);
  console.log(`  Embeddings: ${embeddings ? "gerados" : "não gerados"}`);

  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
