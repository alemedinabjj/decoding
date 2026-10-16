"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { filterParamsSchema } from "@/shared/schemas";
import { OPPORTUNITY_SORT_FIELDS, type FilterParams, type OpportunitySortField, type SortDirection } from "@/shared/types";

/**
 * Estado dos filtros vive na URL: o link é compartilhável e sobrevive a refresh.
 * Chaves: start, end, stage, rep, q, all (todo o período), sort, dir, page.
 */

export function toLocalIsoDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Padrão do dashboard: últimos 12 meses (do 1º dia do mês, 11 meses atrás, até hoje). */
export function defaultPeriod(now = new Date()): Pick<FilterParams, "startDate" | "endDate"> {
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return { startDate: toLocalIsoDate(start), endDate: toLocalIsoDate(now) };
}

export interface TableState {
  sort: OpportunitySortField;
  direction: SortDirection;
  page: number;
}

export function useDashboardFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const isAllTime = searchParams.get("all") === "1";
  const hasCustomPeriod = searchParams.has("start") || searchParams.has("end");

  const filters: FilterParams = useMemo(() => {
    const period = isAllTime ? {} : hasCustomPeriod ? {} : defaultPeriod();
    const parsed = filterParamsSchema.safeParse({
      startDate: searchParams.get("start") ?? period.startDate,
      endDate: searchParams.get("end") ?? period.endDate,
      stage: searchParams.get("stage") ?? undefined,
      salesRepId: searchParams.get("rep") ?? undefined,
      search: searchParams.get("q") ?? undefined,
    });
    // Parâmetros inválidos na URL (ex.: editados à mão) caem no padrão em vez de quebrar a tela.
    return parsed.success ? parsed.data : defaultPeriod();
  }, [searchParams, isAllTime, hasCustomPeriod]);

  const table: TableState = useMemo(() => {
    const sort = searchParams.get("sort");
    const dir = searchParams.get("dir");
    const page = Number(searchParams.get("page") ?? "1");
    return {
      sort: (OPPORTUNITY_SORT_FIELDS as readonly string[]).includes(sort ?? "") ? (sort as OpportunitySortField) : "updatedAt",
      direction: dir === "asc" ? "asc" : "desc",
      page: Number.isInteger(page) && page > 0 ? page : 1,
    };
  }, [searchParams]);

  const update = useCallback(
    (changes: Record<string, string | undefined>, options: { resetPage?: boolean } = { resetPage: true }) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (options.resetPage) next.delete("page");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setPeriod = useCallback(
    (period: { startDate?: string; endDate?: string } | "all" | "default") => {
      if (period === "all") update({ all: "1", start: undefined, end: undefined });
      else if (period === "default") update({ all: undefined, start: undefined, end: undefined });
      else update({ all: undefined, start: period.startDate, end: period.endDate });
    },
    [update],
  );

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const activeFilterCount =
    (isAllTime || hasCustomPeriod ? 1 : 0) +
    (searchParams.get("stage") ? 1 : 0) +
    (searchParams.get("rep") ? 1 : 0) +
    (searchParams.get("q") ? 1 : 0);

  return { filters, table, update, setPeriod, clearFilters, isAllTime, activeFilterCount };
}
