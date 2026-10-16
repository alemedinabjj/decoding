import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    // Os filtros vivem na URL (useSearchParams), que só existe na requisição.
    <Suspense fallback={<KpiCardsSkeleton />}>
      <DashboardView />
    </Suspense>
  );
}
