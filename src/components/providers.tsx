"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IrisProvider } from "@/components/iris/iris-provider";
import { ApiRequestError } from "@/lib/api-client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            // Erros de validação (4xx) não melhoram com nova tentativa.
            retry: (failureCount, error) =>
              !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500) && failureCount < 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={200}>
          <IrisProvider>{children}</IrisProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
