"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { formatBRL, formatInteger } from "@/shared/format";
import type { MonthlyWins } from "@/shared/types";
import type { ChartTooltipProps } from "./chart-card";
import { ChartCard } from "./chart-card";

function WinsTooltip({ active, payload }: ChartTooltipProps) {
  const point = payload?.[0]?.payload as MonthlyWins | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{point.label}</p>
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{formatInteger(point.wonCount)}</span>{" "}
        {point.wonCount === 1 ? "venda ganha" : "vendas ganhas"}
      </p>
      <p className="text-muted-foreground tabular-nums">{formatBRL(point.wonValueCents)}</p>
    </div>
  );
}

interface Props {
  data: MonthlyWins[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  notApplicable: boolean;
}

export function MonthlyWinsChart({ data, isLoading, error, onRetry, notApplicable }: Props) {
  const total = data?.reduce((acc, d) => acc + d.wonCount, 0) ?? 0;

  return (
    <ChartCard
      id="monthly-wins"
      title="Vendas ganhas por mês"
      description="Quantidade de oportunidades ganhas, pelo mês de fechamento."
    >
      {isLoading && !data ? (
        <Skeleton className="h-[280px] w-full" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : notApplicable ? (
        <EmptyState
          icon={<TrendingUp className="size-5" />}
          title="Não se aplica à etapa filtrada"
          description="O gráfico mostra vendas ganhas. Remova o filtro de etapa ou selecione “Ganho”."
        />
      ) : !data || total === 0 ? (
        <EmptyState
          icon={<TrendingUp className="size-5" />}
          title="Nenhuma venda ganha no período"
          description="Amplie o período ou ajuste os filtros para ver a evolução das vendas."
        />
      ) : (
        <>
          <div className="h-[280px] w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 20, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  interval="preserveStartEnd"
                  label={{ value: "Mês de fechamento", position: "insideBottom", offset: -12, fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  label={{ value: "Vendas", angle: -90, position: "insideLeft", offset: 12, fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip content={WinsTooltip} cursor={{ fill: "var(--accent)", opacity: 0.6 }} />
                <Bar dataKey="wonCount" name="Vendas ganhas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Vendas ganhas por mês</caption>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Vendas ganhas</th>
                <th scope="col">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month}>
                  <td>{d.label}</td>
                  <td>{d.wonCount}</td>
                  <td>{formatBRL(d.wonValueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartCard>
  );
}
