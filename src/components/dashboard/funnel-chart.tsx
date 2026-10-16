"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { formatBRLCompact, formatInteger } from "@/shared/format";
import { isOpenStage } from "@/shared/stages";
import type { FunnelStage } from "@/shared/types";
import { ChartCard } from "./chart-card";
import { StageIcon } from "./stage-badge";

function FunnelRow({ item, max, total }: { item: FunnelStage; max: number; total: number }) {
  const width = max > 0 ? Math.max((item.count / max) * 100, item.count > 0 ? 4 : 0) : 0;
  const share = total > 0 ? Math.round((item.count / total) * 100) : 0;
  const tone = item.stage === "ganho" ? "bg-success" : item.stage === "perdido" ? "bg-danger/80" : "bg-chart-1";

  return (
    <li className={cn("grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3", item.count === 0 && "opacity-60")}>
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <StageIcon stage={item.stage} className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{item.label}</span>
      </span>
      <span className="h-7 overflow-hidden rounded-md bg-muted" aria-hidden>
        <span className={cn("block h-full rounded-md transition-[width] duration-300", tone)} style={{ width: `${width}%` }} />
      </span>
      <span className="w-24 text-right text-sm tabular-nums">
        <span className="font-semibold">{formatInteger(item.count)}</span>
        <span className="text-muted-foreground"> · {share}%</span>
      </span>
    </li>
  );
}

interface Props {
  data: FunnelStage[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function FunnelChart({ data, isLoading, error, onRetry }: Props) {
  const total = data?.reduce((acc, s) => acc + s.count, 0) ?? 0;
  const max = Math.max(0, ...(data ?? []).map((s) => s.count));
  const open = data?.filter((s) => isOpenStage(s.stage)) ?? [];
  const closed = data?.filter((s) => !isOpenStage(s.stage)) ?? [];

  return (
    <ChartCard id="funnel" title="Funil de vendas" description="Distribuição das oportunidades em cada uma das 6 etapas.">
      {isLoading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Em andamento</p>
            <ol className="space-y-2.5">
              {open.map((item) => (
                <FunnelRow key={item.stage} item={item} max={max} total={total} />
              ))}
            </ol>
          </div>
          <div className="border-t pt-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Encerradas</p>
            <ol className="space-y-2.5">
              {closed.map((item) => (
                <FunnelRow key={item.stage} item={item} max={max} total={total} />
              ))}
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatInteger(total)} oportunidades no recorte ·{" "}
            {formatBRLCompact(open.reduce((acc, s) => acc + s.valueCents, 0))} em aberto
          </p>
        </div>
      )}
    </ChartCard>
  );
}
