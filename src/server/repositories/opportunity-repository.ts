/**
 * Acesso a dados de oportunidades: apenas consultas SQL, sem regras de exibição.
 * Recebe a conexão por parâmetro — o dashboard usa a conexão principal e a Iris
 * usa a conexão somente leitura, executando exatamente as mesmas queries.
 */
import { asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { leads, opportunities, salesReps } from "../db/schema";
import type * as schema from "../db/schema";
import { APP_TIMEZONE, type FilterParams, type OpportunityQuery, type OpportunitySortField } from "../../shared/types";
import type { Stage } from "../../shared/stages";
import {
  buildFilterConditions,
  buildQueryConditions,
  isOpenCondition,
  isStaleCondition,
  whereAll,
} from "./opportunity-filters";

export type Db = NodePgDatabase<typeof schema>;

export interface MetricsAggregate {
  totalOpportunities: number;
  totalLeads: number;
  openOpportunities: number;
  openValueCents: number;
  wonCount: number;
  lostCount: number;
  wonValueCents: number;
  staleCount: number;
  staleValueCents: number;
}

const num = (expression: SQL) => sql<number>`${expression}`.mapWith(Number);

export async function aggregateMetrics(db: Db, filters: FilterParams, now: Date): Promise<MetricsAggregate> {
  const open = isOpenCondition();
  const stale = isStaleCondition(now);
  const [row] = await db
    .select({
      totalOpportunities: num(sql`count(*)`),
      totalLeads: num(sql`count(distinct ${opportunities.leadId})`),
      openOpportunities: num(sql`count(*) filter (where ${open})`),
      openValueCents: num(sql`coalesce(sum(${opportunities.valueCents}) filter (where ${open}), 0)`),
      wonCount: num(sql`count(*) filter (where ${opportunities.stage} = 'ganho')`),
      lostCount: num(sql`count(*) filter (where ${opportunities.stage} = 'perdido')`),
      wonValueCents: num(sql`coalesce(sum(${opportunities.valueCents}) filter (where ${opportunities.stage} = 'ganho'), 0)`),
      staleCount: num(sql`count(*) filter (where ${stale})`),
      staleValueCents: num(sql`coalesce(sum(${opportunities.valueCents}) filter (where ${stale}), 0)`),
    })
    .from(opportunities)
    .innerJoin(leads, eq(opportunities.leadId, leads.id))
    .where(whereAll(buildFilterConditions(filters)));
  return row;
}

export async function countLeadsInBase(db: Db): Promise<number> {
  const [row] = await db.select({ total: count() }).from(leads);
  return row.total;
}

export interface StageAggregate {
  stage: Stage;
  count: number;
  valueCents: number;
}

export async function aggregateByStage(db: Db, filters: FilterParams): Promise<StageAggregate[]> {
  return db
    .select({
      stage: opportunities.stage,
      count: num(sql`count(*)`),
      valueCents: num(sql`coalesce(sum(${opportunities.valueCents}), 0)`),
    })
    .from(opportunities)
    .innerJoin(leads, eq(opportunities.leadId, leads.id))
    .where(whereAll(buildFilterConditions(filters)))
    .groupBy(opportunities.stage);
}

export interface MonthAggregate {
  month: string;
  wonCount: number;
  wonValueCents: number;
}

/** Ganhos agrupados pelo mês de fechamento (fuso de São Paulo). */
export async function aggregateWinsByMonth(db: Db, filters: FilterParams): Promise<MonthAggregate[]> {
  const month = sql<string>`to_char(date_trunc('month', ${opportunities.closedAt} AT TIME ZONE ${APP_TIMEZONE}), 'YYYY-MM')`;
  return db
    .select({
      month,
      wonCount: num(sql`count(*)`),
      wonValueCents: num(sql`coalesce(sum(${opportunities.valueCents}), 0)`),
    })
    .from(opportunities)
    .innerJoin(leads, eq(opportunities.leadId, leads.id))
    .where(
      whereAll([
        ...buildFilterConditions(filters),
        sql`${opportunities.stage} = 'ganho'`,
        sql`${opportunities.closedAt} is not null`,
      ]),
    )
    .groupBy(month)
    .orderBy(month);
}

/** Mês (YYYY-MM, fuso de SP) da oportunidade mais antiga no recorte. */
export async function earliestCreatedMonth(db: Db, filters: FilterParams): Promise<string | null> {
  const [row] = await db
    .select({
      month: sql<string | null>`to_char(min(${opportunities.createdAt} AT TIME ZONE ${APP_TIMEZONE}), 'YYYY-MM')`,
    })
    .from(opportunities)
    .innerJoin(leads, eq(opportunities.leadId, leads.id))
    .where(whereAll(buildFilterConditions(filters)));
  return row?.month ?? null;
}

export interface OpportunityRecord {
  id: number;
  name: string;
  valueCents: number;
  stage: Stage;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  leadId: number;
  companyName: string;
  contactName: string;
  segment: string;
  salesRepId: number;
  salesRepName: string;
}

const STAGE_ORDER = sql`array_position(array['novo_contato','qualificacao','proposta_enviada','negociacao','ganho','perdido']::stage[], ${opportunities.stage})`;

const SORT_COLUMNS: Record<OpportunitySortField, SQL> = {
  updatedAt: sql`${opportunities.updatedAt}`,
  createdAt: sql`${opportunities.createdAt}`,
  valueCents: sql`${opportunities.valueCents}`,
  stage: STAGE_ORDER,
  companyName: sql`${leads.companyName}`,
  name: sql`${opportunities.name}`,
  salesRep: sql`${salesReps.name}`,
};

export async function findOpportunities(
  db: Db,
  query: OpportunityQuery,
  now: Date,
  pagination: { limit: number; offset: number },
): Promise<{ rows: OpportunityRecord[]; total: number }> {
  const where = whereAll(buildQueryConditions(query, now));
  const sortColumn = SORT_COLUMNS[query.sort ?? "updatedAt"];
  const direction = query.direction ?? "desc";

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: opportunities.id,
        name: opportunities.name,
        valueCents: opportunities.valueCents,
        stage: opportunities.stage,
        notes: opportunities.notes,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
        closedAt: opportunities.closedAt,
        leadId: leads.id,
        companyName: leads.companyName,
        contactName: leads.contactName,
        segment: leads.segment,
        salesRepId: salesReps.id,
        salesRepName: salesReps.name,
      })
      .from(opportunities)
      .innerJoin(leads, eq(opportunities.leadId, leads.id))
      .innerJoin(salesReps, eq(opportunities.salesRepId, salesReps.id))
      .where(where)
      .orderBy(direction === "asc" ? asc(sortColumn) : desc(sortColumn), asc(opportunities.id))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({ total: count() })
      .from(opportunities)
      .innerJoin(leads, eq(opportunities.leadId, leads.id))
      .where(where),
  ]);

  return { rows, total: totalRow.total };
}


