/**
 * Persistência do histórico da Iris. Usa a conexão principal (escrita da
 * aplicação); a role somente leitura da IA não tem acesso a estas tabelas.
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { irisConversations, irisMessages } from "../db/schema";
import type { Db } from "./opportunity-repository";

export async function listConversations(db: Db, visitorId: string, limit = 30) {
  return db
    .select({
      id: irisConversations.id,
      title: irisConversations.title,
      updatedAt: irisConversations.updatedAt,
    })
    .from(irisConversations)
    .where(eq(irisConversations.visitorId, visitorId))
    .orderBy(desc(irisConversations.updatedAt))
    .limit(limit);
}

export async function findConversation(db: Db, visitorId: string, id: string) {
  const [row] = await db
    .select({ id: irisConversations.id, title: irisConversations.title })
    .from(irisConversations)
    .where(and(eq(irisConversations.id, id), eq(irisConversations.visitorId, visitorId)));
  return row ?? null;
}

export async function createConversation(db: Db, visitorId: string, title: string) {
  const [row] = await db.insert(irisConversations).values({ visitorId, title }).returning({ id: irisConversations.id });
  return row.id;
}

export async function deleteConversation(db: Db, visitorId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(irisConversations)
    .where(and(eq(irisConversations.id, id), eq(irisConversations.visitorId, visitorId)))
    .returning({ id: irisConversations.id });
  return rows.length > 0;
}

export async function listMessages(db: Db, conversationId: string) {
  return db
    .select({
      id: irisMessages.id,
      role: irisMessages.role,
      content: irisMessages.content,
      steps: irisMessages.steps,
      createdAt: irisMessages.createdAt,
    })
    .from(irisMessages)
    .where(eq(irisMessages.conversationId, conversationId))
    .orderBy(asc(irisMessages.id));
}

export async function appendMessage(
  db: Db,
  conversationId: string,
  message: { role: "user" | "assistant"; content: string; steps?: string[] },
) {
  await db.transaction(async (tx) => {
    await tx.insert(irisMessages).values({ conversationId, role: message.role, content: message.content, steps: message.steps ?? [] });
    await tx.update(irisConversations).set({ updatedAt: sql`now()` }).where(eq(irisConversations.id, conversationId));
  });
}
