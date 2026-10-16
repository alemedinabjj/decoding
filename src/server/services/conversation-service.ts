import {
  appendMessage,
  createConversation,
  deleteConversation,
  findConversation,
  listConversations,
  listMessages,
} from "../repositories/conversation-repository";
import type { Db } from "../repositories/opportunity-repository";
import { conversationTitle, IRIS_CONTEXT_MESSAGES, type IrisChatMessage, type IrisConversationSummary, type IrisStoredMessage } from "../../shared/iris";

export async function getConversations(db: Db, visitorId: string): Promise<IrisConversationSummary[]> {
  const rows = await listConversations(db, visitorId);
  return rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updatedAt.toISOString() }));
}

/** Mensagens de uma conversa do visitante; `null` se não existir ou for de outro visitante. */
export async function getConversationMessages(db: Db, visitorId: string, id: string): Promise<IrisStoredMessage[] | null> {
  const conversation = await findConversation(db, visitorId, id);
  if (!conversation) return null;
  const rows = await listMessages(db, id);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function removeConversation(db: Db, visitorId: string, id: string): Promise<boolean> {
  return deleteConversation(db, visitorId, id);
}

/**
 * Prepara uma rodada de chat: garante a conversa (cria se for nova), grava a
 * pergunta e devolve o contexto recente que será enviado ao modelo.
 */
export async function startTurn(db: Db, visitorId: string, conversationId: string | undefined, message: string) {
  let id = conversationId;
  let title = conversationTitle(message);
  let history: IrisChatMessage[] = [];

  if (id) {
    const existing = await findConversation(db, visitorId, id);
    if (!existing) return null;
    title = existing.title;
    const rows = await listMessages(db, id);
    history = rows.slice(-IRIS_CONTEXT_MESSAGES).map((row) => ({ role: row.role, content: row.content }));
  } else {
    id = await createConversation(db, visitorId, title);
  }

  await appendMessage(db, id, { role: "user", content: message });
  return { id, title, messages: [...history, { role: "user" as const, content: message }] };
}

export async function finishTurn(db: Db, conversationId: string, answer: string, steps: string[]) {
  if (!answer.trim()) return;
  await appendMessage(db, conversationId, { role: "assistant", content: answer, steps });
}
