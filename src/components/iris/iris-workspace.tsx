"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ConversationList } from "./conversation-list";
import { IrisChat } from "./iris-chat";

/** Página da Iris: histórico à esquerda (gaveta no mobile) e conversa à direita. */
export function IrisWorkspace() {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-6xl overflow-hidden rounded-xl border bg-card shadow-xs">
      <ConversationList className="hidden w-72 shrink-0 border-r md:flex" />

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-80 gap-0 p-0">
          <SheetTitle className="sr-only">Histórico de conversas</SheetTitle>
          <ConversationList className="h-full pt-10" onSelect={() => setHistoryOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setHistoryOpen(true)} aria-label="Abrir histórico">
            <History />
          </Button>
          <div>
            <h1 className="text-base font-semibold">Iris · assistente comercial</h1>
            <p className="text-sm text-muted-foreground">Consulta os dados do CRM em modo somente leitura.</p>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <IrisChat />
        </div>
      </div>
    </div>
  );
}
