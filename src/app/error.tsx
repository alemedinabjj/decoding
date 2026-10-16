"use client";

import { ErrorState } from "@/components/shared/states";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error);
  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-card">
      <ErrorState message="Ocorreu um erro inesperado ao exibir esta página." onRetry={reset} />
    </div>
  );
}
