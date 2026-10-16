"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIris } from "@/components/iris/iris-provider";
import { IrisPanel } from "@/components/iris/iris-panel";
import { AppSidebar, SidebarNav } from "./app-sidebar";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";

const COLLAPSED_KEY = "decoding:sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setPanelOpen } = useIris();
  const onIrisPage = pathname.startsWith("/iris");

  useEffect(() => {
    // Preferência por visitante; lida após a hidratação para não divergir do HTML do servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* armazenamento indisponível: preferência vale só para esta sessão */
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-dvh">
      <AppSidebar collapsed={collapsed} onToggle={toggleCollapsed} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center px-4">
            <Brand />
          </div>
          <div className="px-3">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <div className="lg:hidden">
            <span className="text-sm font-semibold">Decoding CRM</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {!onIrisPage && (
              <Button variant="outline" onClick={() => setPanelOpen(true)} className="gap-2">
                <Sparkles className="text-brand-sky" />
                <span className="hidden sm:inline">Perguntar à Iris</span>
                <span className="sm:hidden">Iris</span>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {!onIrisPage && (
        <Suspense fallback={null}>
          <IrisPanel />
        </Suspense>
      )}
    </div>
  );
}
