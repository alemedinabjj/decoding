"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatRelativeDays } from "@/shared/format";
import { daysBetween } from "@/shared/rules";
import type { IrisConversationSummary } from "@/shared/iris";
import { IRIS_CONVERSATIONS_KEY, useIris } from "./iris-provider";

/** Histórico de conversas do visitante (mais recentes primeiro). */
export function ConversationList({ className, onSelect }: { className?: string; onSelect?: () => void }) {
  const { conversationId, openConversation, newConversation, forgetConversation, isBusy } = useIris();
  const queryClient = useQueryClient();
  const conversations = useQuery({
    queryKey: IRIS_CONVERSATIONS_KEY,
    queryFn: ({ signal }) => apiGet<IrisConversationSummary[]>("/api/conversations", {}, signal),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error("Não foi possível excluir a conversa.");
      return id;
    },
    onSuccess: (id) => {
      forgetConversation(id);
      void queryClient.invalidateQueries({ queryKey: IRIS_CONVERSATIONS_KEY });
    },
  });

  return (
    <nav aria-label="Histórico de conversas" className={cn("flex min-h-0 flex-col", className)}>
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => {
            newConversation();
            onSelect?.();
          }}
          disabled={isBusy}
        >
          <Plus /> Nova conversa
        </Button>
      </div>
      <p className="px-4 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Histórico</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {conversations.isLoading ? (
          <div className="space-y-2 px-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : conversations.error ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Não foi possível carregar o histórico.{" "}
            <button type="button" className="underline" onClick={() => void conversations.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : !conversations.data?.length ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Suas conversas com a Iris aparecem aqui.</p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.data.map((conversation) => {
              const active = conversation.id === conversationId;
              return (
                <li key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      void openConversation(conversation.id).catch(() => undefined);
                      onSelect?.();
                    }}
                    disabled={isBusy}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-2 pr-8 text-left text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                      active && "bg-accent font-medium",
                    )}
                  >
                    <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{conversation.title}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {formatRelativeDays(daysBetween(new Date(conversation.updatedAt), new Date()))}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(conversation.id)}
                    aria-label={`Excluir conversa: ${conversation.title}`}
                    className="absolute top-2 right-1.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity outline-none group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
