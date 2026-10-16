/**
 * Busca híbrida de leads: trigram (nomes, erros de digitação) + vetor
 * (intenção, ex.: "empresas de logística"), combinados por Reciprocal Rank Fusion.
 */
import { findLeadsWithOpportunities, searchLeadsByEmbedding, searchLeadsByTrigram, type RankedLead } from "../repositories/lead-repository";
import type { Db } from "../repositories/opportunity-repository";

export type EmbedFn = (text: string) => Promise<number[] | null>;

/** Constante clássica do RRF: suaviza a diferença entre as primeiras posições. */
export const RRF_K = 60;

/** Similaridade de cosseno mínima para um resultado vetorial ser considerado relevante. */
export const MIN_VECTOR_SIMILARITY = 0.3;

export function reciprocalRankFusion(rankings: RankedLead[][], k = RRF_K): { id: number; score: number }[] {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach((item, index) => {
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

export interface HybridSearchResult {
  mode: "hybrid" | "trigram";
  leads: Awaited<ReturnType<typeof findLeadsWithOpportunities>>;
}

export async function hybridLeadSearch(db: Db, query: string, embed: EmbedFn | undefined, limit = 5): Promise<HybridSearchResult> {
  const candidates = limit * 4;
  const [byText, embedding] = await Promise.all([
    searchLeadsByTrigram(db, query, candidates),
    embed ? embed(query).catch(() => null) : Promise.resolve(null),
  ]);
  // O vetor sempre devolve "os mais próximos", mesmo sem relação real: corta pelo limiar de similaridade.
  const byVector = embedding
    ? (await searchLeadsByEmbedding(db, embedding, candidates)).filter((item) => item.score >= MIN_VECTOR_SIMILARITY)
    : [];

  const fused = reciprocalRankFusion(embedding ? [byText, byVector] : [byText]).slice(0, limit);
  const details = await findLeadsWithOpportunities(db, fused.map((f) => f.id));
  const order = new Map(fused.map((f, index) => [f.id, index]));

  return {
    mode: embedding ? "hybrid" : "trigram",
    leads: details.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
  };
}
