import type { Stage } from "./stages";

/** Fuso usado para interpretar datas de filtro e agrupar por mês. */
export const APP_TIMEZONE = "America/Sao_Paulo";

export interface SalesRep {
  id: number;
  name: string;
  email: string;
}

export interface Lead {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  segment: string;
  description: string;
}

export interface Opportunity {
  id: number;
  name: string;
  valueCents: number;
  stage: Stage;
  notes: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  lead: Pick<Lead, "id" | "companyName" | "contactName" | "segment">;
  salesRep: Pick<SalesRep, "id" | "name">;
  /** Aberta e sem atualização há mais de STALE_AFTER_DAYS dias. */
  isStale: boolean;
  daysSinceUpdate: number;
}

/** Filtros globais do dashboard (também aceitos pelas ferramentas da Iris). */
export interface FilterParams {
  /** Data inicial (YYYY-MM-DD), inclusiva, sobre a data de criação da oportunidade. */
  startDate?: string;
  /** Data final (YYYY-MM-DD), inclusiva. */
  endDate?: string;
  stage?: Stage;
  salesRepId?: number;
  /** Busca por nome do lead, contato ou oportunidade. */
  search?: string;
}

export type OpportunityStatus = "open" | "closed";

export const OPPORTUNITY_SORT_FIELDS = [
  "updatedAt",
  "createdAt",
  "valueCents",
  "stage",
  "companyName",
  "name",
  "salesRep",
] as const;
export type OpportunitySortField = (typeof OPPORTUNITY_SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export interface OpportunityQuery extends FilterParams {
  /** Busca uma oportunidade específica (usado pela Iris no "Perguntar à Iris"). */
  opportunityId?: number;
  status?: OpportunityStatus;
  staleOnly?: boolean;
  sort?: OpportunitySortField;
  direction?: SortDirection;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Quais indicadores fazem sentido para o filtro de etapa atual. */
export interface MetricApplicability {
  open: boolean;
  closed: boolean;
}

export interface DashboardMetrics {
  /** Total de oportunidades no recorte — 0 significa "sem dados" (empty state). */
  totalOpportunities: number;
  /** Leads distintos com oportunidades no recorte. */
  totalLeads: number;
  /** Leads cadastrados na base, independente de filtros. */
  totalLeadsInBase: number;
  openOpportunities: number;
  /** Soma dos valores das oportunidades abertas (centavos). */
  openValueCents: number;
  wonCount: number;
  lostCount: number;
  wonValueCents: number;
  /** Ganhos / (Ganhos + Perdidos) × 100. `null` quando não há encerradas. */
  conversionRate: number | null;
  staleCount: number;
  staleValueCents: number;
  /** Valor parado / valor em negociação × 100. `null` quando não há valor em negociação. */
  riskIndex: number | null;
  applicability: MetricApplicability;
  /** Momento de referência usado nos cálculos ("hoje"). */
  referenceDate: string;
}

export interface FunnelStage {
  stage: Stage;
  label: string;
  count: number;
  valueCents: number;
}

export interface MonthlyWins {
  /** YYYY-MM */
  month: string;
  /** Rótulo curto em pt-BR, ex.: "out/26". */
  label: string;
  wonCount: number;
  wonValueCents: number;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
