"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
import { formatBRL, formatBRLCompact, formatInteger } from "@/shared/format";
import type { FunnelStage } from "@/shared/types";
import type { ChartTooltipProps } from "./chart-card";
import { ChartCard } from "./chart-card";

function ValueTooltip({ active, payload }: ChartTooltipProps) {
  const item = payload?.[0]?.payload as FunnelStage | undefined;
  if (!active || !item) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{item.label}</p>
      <p className="font-semibold tabular-nums">{formatBRL(item.valueCents)}</p>
      <p className="text-muted-foreground">
        {formatInteger(item.count)} {item.count === 1 ? "oportunidade" : "oportunidades"}
      </p>
    </div>
  );
}

interface Props {
  data: FunnelStage[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

/** Diferencial: distribuição do valor (R$) por etapa — complementa o funil, que mostra quantidades. */
export function StageValueChart({ data, isLoading, error, onRetry }: Props) {
  return (
    <ChartCard id="stage-value" title="Valor por etapa" description="Soma dos valores estimados em cada etapa do funil.">
      {isLoading && !data ? (
        <Skeleton className="h-[280px] w-full" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : (
        <>
          <div className="h-[280px] w-full" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatBRLCompact(v)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={118}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip content={ValueTooltip} cursor={{ fill: "var(--accent)", opacity: 0.6 }} />
                <Bar dataKey="valueCents" name="Valor" fill="var(--chart-2)" radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Valor por etapa</caption>
            <thead>
              <tr>
                <th scope="col">Etapa</th>
                <th scope="col">Valor</th>
                <th scope="col">Oportunidades</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((d) => (
                <tr key={d.stage}>
                  <td>{d.label}</td>
                  <td>{formatBRL(d.valueCents)}</td>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartCard>
  );
}
