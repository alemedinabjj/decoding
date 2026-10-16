"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type {
  DashboardMetrics,
  FilterParams,
  FunnelStage,
  MonthlyWins,
  Opportunity,
  OpportunityQuery,
  Paginated,
  SalesRep,
} from "@/shared/types";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  metrics: (filters: FilterParams) => ["dashboard", "metrics", filters] as const,
  funnel: (filters: FilterParams) => ["dashboard", "funnel", filters] as const,
  monthlyWins: (filters: FilterParams) => ["dashboard", "monthly-wins", filters] as const,
  opportunities: (query: OpportunityQuery) => ["dashboard", "opportunities", query] as const,
  salesReps: ["sales-reps"] as const,
};

export function useMetrics(filters: FilterParams) {
  return useQuery({
    queryKey: dashboardKeys.metrics(filters),
    queryFn: ({ signal }) => apiGet<DashboardMetrics>("/api/dashboard/metrics", filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useFunnel(filters: FilterParams) {
  return useQuery({
    queryKey: dashboardKeys.funnel(filters),
    queryFn: ({ signal }) => apiGet<FunnelStage[]>("/api/dashboard/funnel", filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useMonthlyWins(filters: FilterParams) {
  return useQuery({
    queryKey: dashboardKeys.monthlyWins(filters),
    queryFn: ({ signal }) => apiGet<MonthlyWins[]>("/api/dashboard/monthly-wins", filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useOpportunities(query: OpportunityQuery) {
  return useQuery({
    queryKey: dashboardKeys.opportunities(query),
    queryFn: ({ signal }) => apiGet<Paginated<Opportunity>>("/api/opportunities", query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSalesReps() {
  return useQuery({
    queryKey: dashboardKeys.salesReps,
    queryFn: ({ signal }) => apiGet<SalesRep[]>("/api/sales-reps", {}, signal),
    staleTime: 5 * 60_000,
  });
}
