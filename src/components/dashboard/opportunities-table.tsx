"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Clock, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useIris } from "@/components/iris/iris-provider";
import { useOpportunities } from "@/hooks/use-dashboard-data";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { formatBRL, formatDate, formatInteger, formatRelativeDays } from "@/shared/format";
import type { Opportunity, OpportunitySortField } from "@/shared/types";
import { StageBadge } from "./stage-badge";

const PAGE_SIZE = 10;

const COLUMNS: { key: OpportunitySortField; label: string; align?: "right" }[] = [
  { key: "companyName", label: "Lead / empresa" },
  { key: "name", label: "Oportunidade" },
  { key: "stage", label: "Etapa" },
  { key: "valueCents", label: "Valor estimado", align: "right" },
  { key: "salesRep", label: "Responsável" },
  { key: "updatedAt", label: "Última atualização" },
];

function SearchField() {
  const { filters, update } = useDashboardFilters();
  const urlValue = filters.search ?? "";
  const [value, setValue] = useState(urlValue);
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue);
  const debounced = useDebouncedValue(value, 350);

  // Se a URL mudar por fora (ex.: "Limpar filtros"), o campo acompanha.
  // Mudanças causadas pela própria digitação (urlValue === debounced) são ignoradas.
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue);
    if (urlValue !== debounced.trim()) setValue(urlValue);
  }

  const latest = useRef({ urlValue, update });
  useEffect(() => {
    latest.current = { urlValue, update };
  });

  // Só reage à digitação (valor com debounce), nunca a mudanças externas da URL.
  useEffect(() => {
    const { urlValue: current, update: apply } = latest.current;
    if (debounced.trim() !== current) apply({ q: debounced.trim() || undefined });
  }, [debounced]);

  return (
    <div className="relative w-full sm:w-72">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar lead, empresa ou oportunidade"
        aria-label="Buscar por lead, empresa ou oportunidade"
        className="pr-8 pl-8"
        maxLength={100}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Limpar busca"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function SortHeader({ column }: { column: (typeof COLUMNS)[number] }) {
  const { table, update } = useDashboardFilters();
  const active = table.sort === column.key;
  const Icon = !active ? ArrowUpDown : table.direction === "asc" ? ArrowUp : ArrowDown;

  const toggle = () => {
    const direction = active && table.direction === "desc" ? "asc" : "desc";
    update({ sort: column.key, dir: direction });
  };

  return (
    <TableHead
      aria-sort={active ? (table.direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(column.align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "inline-flex items-center gap-1 rounded font-medium outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {column.label}
        <Icon aria-hidden className="size-3.5" />
      </button>
    </TableHead>
  );
}

function UpdatedCell({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="tabular-nums">{formatDate(opportunity.updatedAt)}</span>
      {opportunity.isStale ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
          <Clock aria-hidden className="size-3" />
          Parada {formatRelativeDays(opportunity.daysSinceUpdate)}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{formatRelativeDays(opportunity.daysSinceUpdate)}</span>
      )}
    </div>
  );
}

export function OpportunitiesTable() {
  const { filters, table, update, clearFilters } = useDashboardFilters();
  const { askFromDashboard } = useIris();
  const query = { ...filters, sort: table.sort, direction: table.direction, page: table.page, pageSize: PAGE_SIZE };
  const { data, isLoading, isFetching, error, refetch } = useOpportunities(query);

  const firstItem = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastItem = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  const askAbout = (o: Opportunity) =>
    askFromDashboard(
      // O id garante uma consulta exata (get_opportunity), sem depender de busca por nome.
      `Resuma a oportunidade #${o.id} ("${o.name}", ${o.lead.companyName}) e recomende o próximo passo.`,
      undefined,
    );

  return (
    <section aria-labelledby="opportunities-title" className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 id="opportunities-title" className="text-base font-semibold">
            Leads e oportunidades
          </h2>
          <p className="text-sm text-muted-foreground">
            {data ? `${formatInteger(data.total)} oportunidades no recorte` : "Negociações com lead, etapa, valor e responsável."}
          </p>
        </div>
        <SearchField />
      </div>

      {isLoading && !data ? (
        <div className="space-y-2 px-4 pb-4 sm:px-5" aria-busy="true" aria-label="Carregando oportunidades">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : !data || data.total === 0 ? (
        <EmptyState
          title="Nenhuma oportunidade encontrada"
          description={
            filters.search
              ? `Nada corresponde a “${filters.search}” com os filtros atuais. Verifique a grafia ou limpe a busca.`
              : "Nenhuma oportunidade corresponde aos filtros selecionados."
          }
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <>
          <div className={cn("transition-opacity", isFetching && "opacity-60")}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((column) => (
                    <SortHeader key={column.key} column={column} />
                  ))}
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{o.lead.companyName}</span>
                        <span className="text-xs text-muted-foreground">{o.lead.contactName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 truncate" title={o.name}>
                      {o.name}
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={o.stage} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatBRL(o.valueCents)}</TableCell>
                    <TableCell>{o.salesRep.name}</TableCell>
                    <TableCell>
                      <UpdatedCell opportunity={o} />
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" onClick={() => askAbout(o)} aria-label={`Perguntar à Iris sobre ${o.name} da ${o.lead.companyName}`}>
                              <Sparkles className="text-brand-sky" />
                            </Button>
                          }
                        />
                        <TooltipContent>Perguntar à Iris</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:px-5">
            <p className="text-muted-foreground" aria-live="polite">
              Mostrando <span className="font-medium text-foreground tabular-nums">{firstItem}–{lastItem}</span> de{" "}
              <span className="font-medium text-foreground tabular-nums">{formatInteger(data.total)}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => update({ page: String(data.page - 1) }, { resetPage: false })}
                disabled={data.page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft /> Anterior
              </Button>
              <span className="px-1 text-muted-foreground tabular-nums">
                {data.page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => update({ page: String(data.page + 1) }, { resetPage: false })}
                disabled={data.page >= data.totalPages}
                aria-label="Próxima página"
              >
                Próxima <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
