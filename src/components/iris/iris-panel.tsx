"use client";

import Link from "next/link";
import { History, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { useIris } from "./iris-provider";
import { IrisChat } from "./iris-chat";

/** Painel lateral sobre o dashboard: a Iris recebe os filtros que o usuário está vendo. */
export function IrisPanel() {
  const { panelOpen, setPanelOpen } = useIris();
  const { filters } = useDashboardFilters();

  return (
    <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-sky" /> Iris
          </SheetTitle>
          <SheetDescription className="flex items-center justify-between gap-2">
            <span>Considera os filtros do dashboard quando relevante.</span>
            <Link
              href="/iris"
              onClick={() => setPanelOpen(false)}
              className="inline-flex shrink-0 items-center gap-1 text-xs underline-offset-2 hover:underline"
            >
              <History className="size-3" /> Histórico
            </Link>
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <IrisChat dashboardFilters={{ ...filters, search: undefined }} compact />
        </div>
      </SheetContent>
    </Sheet>
  );
}
