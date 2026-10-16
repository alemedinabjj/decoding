import { and, asc, eq, inArray, isNotNull, max, min, sql } from "drizzle-orm";
import { leads, opportunities, salesReps } from "../db/schema";
import type { Db } from "./opportunity-repository";
import type { Stage } from "../../shared/stages";

export interface RankedLead {
  id: number;
  score: number;
}

/**
 * Candidatos por similaridade textual (pg_trgm + unaccent): tolera erros de
 * digitação e acentos em nomes de empresas e contatos.
 */
export async function searchLeadsByTrigram(db: Db, query: string, limit: number): Promise<RankedLead[]> {
  const q = sql`unaccent(lower(${query}))`;
  const score = sql<number>`greatest(
    similarity(unaccent(lower(${leads.companyName})), ${q}),
    similarity(unaccent(lower(${leads.contactName})), ${q}),
    word_similarity(${q}, unaccent(lower(${leads.companyName} || ' ' || ${leads.segment} || ' ' || ${leads.description})))
  )`.mapWith(Number);
  return db
    .select({ id: leads.id, score })
    .from(leads)
    .where(sql`${score} > 0.2`)
    .orderBy(sql`${score} desc`)
    .limit(limit);
}

/** Candidatos por similaridade semântica (pgvector, distância de cosseno). */
export async function searchLeadsByEmbedding(db: Db, embedding: number[], limit: number): Promise<RankedLead[]> {
  const vector = JSON.stringify(embedding);
  const distance = sql<number>`(${leads.embedding} <=> ${vector}::vector)`.mapWith(Number);
  const rows = await db
    .select({ id: leads.id, distance })
    .from(leads)
    .where(isNotNull(leads.embedding))
    .orderBy(distance)
    .limit(limit);
  return rows.map((row) => ({ id: row.id, score: 1 - row.distance }));
}

export interface LeadWithOpportunities {
  id: number;
  companyName: string;
  contactName: string;
  segment: string;
  description: string;
  opportunities: {
    id: number;
    name: string;
    stage: Stage;
    valueCents: number;
    updatedAt: Date;
    salesRepName: string;
  }[];
}

export async function findLeadsWithOpportunities(db: Db, ids: number[]): Promise<LeadWithOpportunities[]> {
  if (ids.length === 0) return [];
  const [leadRows, opportunityRows] = await Promise.all([
    db
      .select({
        id: leads.id,
        companyName: leads.companyName,
        contactName: leads.contactName,
        segment: leads.segment,
        description: leads.description,
      })
      .from(leads)
      .where(inArray(leads.id, ids)),
    db
      .select({
        id: opportunities.id,
        leadId: opportunities.leadId,
        name: opportunities.name,
        stage: opportunities.stage,
        valueCents: opportunities.valueCents,
        updatedAt: opportunities.updatedAt,
        salesRepName: salesReps.name,
      })
      .from(opportunities)
      .innerJoin(salesReps, eq(opportunities.salesRepId, salesReps.id))
      .where(and(inArray(opportunities.leadId, ids)))
      .orderBy(asc(opportunities.createdAt)),
  ]);

  return leadRows.map((lead) => ({
    ...lead,
    opportunities: opportunityRows
      .filter((o) => o.leadId === lead.id)
      .map((o) => ({
        id: o.id,
        name: o.name,
        stage: o.stage,
        valueCents: o.valueCents,
        updatedAt: o.updatedAt,
        salesRepName: o.salesRepName,
      })),
  }));
}

/** Intervalo de datas coberto pela base — usado para a Iris não inventar períodos sem dados. */
export async function findDataCoverage(db: Db) {
  const [row] = await db
    .select({
      earliest: min(opportunities.createdAt),
      latest: max(opportunities.createdAt),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(opportunities);
  return row;
}
