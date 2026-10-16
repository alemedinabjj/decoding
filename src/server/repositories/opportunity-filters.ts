import { and, eq, inArray, lt, sql, type SQL } from "drizzle-orm";
import { leads, opportunities } from "../db/schema";
import { CLOSED_STAGES, OPEN_STAGES } from "../../shared/stages";
import { APP_TIMEZONE, type FilterParams, type OpportunityQuery } from "../../shared/types";
import { staleCutoff } from "../../shared/rules";

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "a", "o", "em"]);

/** Escapa curingas do LIKE digitados pelo usuário. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const isOpenCondition = (): SQL => inArray(opportunities.stage, [...OPEN_STAGES]);
export const isClosedCondition = (): SQL => inArray(opportunities.stage, [...CLOSED_STAGES]);
export const isStaleCondition = (now: Date): SQL =>
  and(isOpenCondition(), lt(opportunities.updatedAt, staleCutoff(now))) as SQL;

/**
 * Converte os filtros globais em condições SQL. Toda consulta que usa estas
 * condições deve fazer JOIN com `leads` (a busca textual depende dele).
 *
 * Datas são interpretadas no fuso de São Paulo: o dia inteiro de `endDate` é incluído.
 */
export function buildFilterConditions(filters: FilterParams): SQL[] {
  const conditions: SQL[] = [];

  if (filters.startDate) {
    conditions.push(
      sql`${opportunities.createdAt} >= (${filters.startDate}::date::timestamp AT TIME ZONE ${APP_TIMEZONE})`,
    );
  }
  if (filters.endDate) {
    conditions.push(
      sql`${opportunities.createdAt} < ((${filters.endDate}::date + 1)::timestamp AT TIME ZONE ${APP_TIMEZONE})`,
    );
  }
  if (filters.stage) {
    conditions.push(eq(opportunities.stage, filters.stage));
  }
  if (filters.salesRepId) {
    conditions.push(eq(opportunities.salesRepId, filters.salesRepId));
  }
  if (filters.search) {
    // Cada palavra precisa aparecer em algum dos campos: "whatsapp moreira" encontra
    // a oportunidade "Integração com WhatsApp" da "Advocacia Moreira & Associados".
    const haystack = sql`unaccent(${leads.companyName} || ' ' || ${leads.contactName} || ' ' || ${opportunities.name})`;
    const tokens = filters.search
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token.toLowerCase()));
    const allTokens = tokens.map((token) => sql`${haystack} ILIKE unaccent(${`%${escapeLike(token)}%`})`);
    conditions.push(sql`(
      ${allTokens.length ? sql.join(allTokens, sql` AND `) : sql`false`}
      OR similarity(unaccent(lower(${leads.companyName})), unaccent(lower(${filters.search}))) > 0.35
    )`);
  }

  return conditions;
}

export function buildQueryConditions(query: OpportunityQuery, now: Date): SQL[] {
  const conditions = buildFilterConditions(query);
  if (query.opportunityId) conditions.push(eq(opportunities.id, query.opportunityId));
  if (query.status === "open") conditions.push(isOpenCondition());
  if (query.status === "closed") conditions.push(isClosedCondition());
  if (query.staleOnly) conditions.push(isStaleCondition(now));
  return conditions;
}

export function whereAll(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}
