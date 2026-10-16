import type { Metadata } from "next";
import { IrisChat } from "@/components/iris/iris-chat";

export const metadata: Metadata = { title: "Iris" };

export default function IrisPage() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="border-b px-4 py-3">
        <h1 className="text-base font-semibold">Iris · assistente comercial</h1>
        <p className="text-sm text-muted-foreground">Consulta os dados do CRM em modo somente leitura.</p>
      </div>
      <div className="min-h-0 flex-1">
        <IrisChat />
      </div>
    </div>
  );
}
