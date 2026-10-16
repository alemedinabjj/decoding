import { z } from "zod";
import { filterParamsSchema } from "./schemas";

/** Quantas mensagens anteriores do histórico são enviadas ao modelo como contexto. */
export const IRIS_CONTEXT_MESSAGES = 20;
export const IRIS_MAX_MESSAGE_LENGTH = 2000;

/**
 * O cliente envia apenas a nova mensagem e o id da conversa: o histórico é
 * carregado do banco no servidor. Isso evita que alguém forje mensagens
 * anteriores "da assistente" para manipular a IA.
 */
export const irisChatRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(IRIS_MAX_MESSAGE_LENGTH),
  /** Filtros que o usuário está vendo no dashboard, quando a Iris é aberta pelo painel. */
  dashboardFilters: filterParamsSchema.optional(),
});

export type IrisChatRequest = z.infer<typeof irisChatRequestSchema>;

export interface IrisChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Eventos enviados pelo servidor via Server-Sent Events (`data: <json>\n\n`). */
export type IrisStreamEvent =
  | { type: "conversation"; id: string; title: string }
  | { type: "status"; tool: string; label: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface IrisConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface IrisStoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  steps: string[];
  createdAt: string;
}

export function conversationTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean;
}
