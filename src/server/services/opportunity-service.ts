import { findOpportunities, type Db, type OpportunityRecord } from "../repositories/opportunity-repository";
import { findAllSalesReps } from "../repositories/sales-rep-repository";
import { daysBetween, isStale } from "../../shared/rules";
import type { Opportunity, OpportunityQuery, Paginated, SalesRep } from "../../shared/types";

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export function toOpportunity(record: OpportunityRecord, now: Date): Opportunity {
  return {
    id: record.id,
    name: record.name,
    valueCents: record.valueCents,
    stage: record.stage,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    closedAt: record.closedAt?.toISOString() ?? null,
    lead: {
      id: record.leadId,
      companyName: record.companyName,
      contactName: record.contactName,
      segment: record.segment,
    },
    salesRep: { id: record.salesRepId, name: record.salesRepName },
    isStale: isStale(record.stage, record.updatedAt, now),
    daysSinceUpdate: daysBetween(record.updatedAt, now),
  };
}

export async function listOpportunities(db: Db, query: OpportunityQuery, now: Date): Promise<Paginated<Opportunity>> {
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(query.page ?? 1, 1);
  const { rows, total } = await findOpportunities(db, query, now, { limit: pageSize, offset: (page - 1) * pageSize });
  return {
    items: rows.map((row) => toOpportunity(row, now)),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Oportunidades abertas sem atualização há mais de 7 dias, das mais valiosas
 * para as menos — a lista que a Iris usa para recomendar follow-up.
 */
export async function listStaleOpportunities(db: Db, query: OpportunityQuery, now: Date) {
  return listOpportunities(
    db,
    { ...query, status: "open", staleOnly: true, sort: "valueCents", direction: "desc", page: 1, pageSize: MAX_PAGE_SIZE },
    now,
  );
}

export async function listSalesReps(db: Db): Promise<SalesRep[]> {
  return findAllSalesReps(db);
}
