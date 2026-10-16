"use client";

import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultPeriod, toLocalIsoDate, useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { useSalesReps } from "@/hooks/use-dashboard-data";
import { STAGES, STAGE_LABELS } from "@/shared/stages";

type PresetKey = "12m" | "month" | "30d" | "90d" | "year" | "all" | "custom";

const PRESET_LABELS: Record<PresetKey, string> = {
  "12m": "Últimos 12 meses",
  month: "Este mês",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  year: "Este ano",
  all: "Todo o período",
  custom: "Personalizado",
};

function presetRange(key: Exclude<PresetKey, "all" | "custom">, now = new Date()) {
  const end = toLocalIsoDate(now);
  const daysAgo = (days: number) => toLocalIsoDate(new Date(now.getTime() - days * 86_400_000));
  switch (key) {
    case "12m":
      return defaultPeriod(now);
    case "month":
      return { startDate: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: end };
    case "30d":
      return { startDate: daysAgo(29), endDate: end };
    case "90d":
      return { startDate: daysAgo(89), endDate: end };
    case "year":
      return { startDate: toLocalIsoDate(new Date(now.getFullYear(), 0, 1)), endDate: end };
  }
}

const ALL = "all";

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

export function FiltersBar() {
  const { filters, update, setPeriod, clearFilters, isAllTime, activeFilterCount } = useDashboardFilters();
  const salesReps = useSalesReps();

  const currentPreset: PresetKey = isAllTime
    ? "all"
    : ((Object.keys(PRESET_LABELS) as PresetKey[]).find((key) => {
        if (key === "all" || key === "custom") return false;
        const range = presetRange(key);
        return range.startDate === filters.startDate && range.endDate === filters.endDate;
      }) ?? "custom");

  const handlePreset = (key: PresetKey) => {
    if (key === "custom") return;
    if (key === "all") setPeriod("all");
    else if (key === "12m") setPeriod("default");
    else setPeriod(presetRange(key));
  };

  const stageItems = [{ value: ALL, label: "Todas as etapas" }, ...STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))];
  const repItems = [
    { value: ALL, label: "Todos os responsáveis" },
    ...(salesReps.data ?? []).map((rep) => ({ value: String(rep.id), label: rep.name })),
  ];
  const presetItems = (Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => ({ value: key, label: PRESET_LABELS[key] }));

  return (
    <section aria-label="Filtros do dashboard" className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Período</FieldLabel>
          <Select items={presetItems} value={currentPreset} onValueChange={(value) => value && handlePreset(value as PresetKey)}>
            <SelectTrigger aria-label="Período" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {presetItems.map((item) => (
                <SelectItem key={item.value} value={item.value} disabled={item.value === "custom"}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="filter-start">Data inicial</FieldLabel>
          <Input
            id="filter-start"
            type="date"
            value={filters.startDate ?? ""}
            max={filters.endDate}
            onChange={(e) => setPeriod({ startDate: e.target.value || undefined, endDate: filters.endDate })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="filter-end">Data final</FieldLabel>
          <Input
            id="filter-end"
            type="date"
            value={filters.endDate ?? ""}
            min={filters.startDate}
            onChange={(e) => setPeriod({ startDate: filters.startDate, endDate: e.target.value || undefined })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Etapa</FieldLabel>
          <Select
            items={stageItems}
            value={filters.stage ?? ALL}
            onValueChange={(value) => update({ stage: !value || value === ALL ? undefined : value })}
          >
            <SelectTrigger aria-label="Etapa da negociação" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stageItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Responsável</FieldLabel>
          <Select
            items={repItems}
            value={filters.salesRepId ? String(filters.salesRepId) : ALL}
            onValueChange={(value) => update({ rep: !value || value === ALL ? undefined : value })}
            disabled={salesReps.isError}
          >
            <SelectTrigger aria-label="Responsável comercial" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {repItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
          className="h-8 gap-1.5 justify-self-start text-muted-foreground lg:justify-self-end"
        >
          <FilterX className="size-4" />
          Limpar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>
    </section>
  );
}
