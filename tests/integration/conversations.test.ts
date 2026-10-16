/**
 * Histórico da Iris contra o banco real. Cria dados com um visitante
 * exclusivo do teste e remove tudo ao final.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { irisConversations } from "@/server/db/schema";
import type { Db } from "@/server/repositories/opportunity-repository";
import {
  finishTurn,
  getConversationMessages,
  getConversations,
  removeConversation,
  startTurn,
} from "@/server/services/conversation-service";
import { closeAll, connect, hasDatabase } from "./helpers";

describe.skipIf(!hasDatabase)("histórico de conversas", () => {
  let db: Db;
  let readonlyDb: Db;
  const visitor = `test-${randomUUID()}`;
  const intruder = `test-${randomUUID()}`;

  beforeAll(() => {
    db = connect(process.env.DATABASE_URL);
    readonlyDb = connect(process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL);
  });

  afterAll(async () => {
    await db.delete(irisConversations).where(eq(irisConversations.visitorId, visitor));
    await closeAll();
  });

  it("cria a conversa na primeira pergunta e acumula o contexto nas seguintes", async () => {
    const first = await startTurn(db, visitor, undefined, "Quais negociações precisam de atenção?");
    expect(first).not.toBeNull();
    expect(first!.title).toBe("Quais negociações precisam de atenção?");
    await finishTurn(db, first!.id, "Há 12 negociações paradas.", ["Procurando oportunidades paradas"]);

    const second = await startTurn(db, visitor, first!.id, "E da Juliana?");
    expect(second!.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);

    const messages = await getConversationMessages(db, visitor, first!.id);
    expect(messages!.map((m) => m.content)).toEqual([
      "Quais negociações precisam de atenção?",
      "Há 12 negociações paradas.",
      "E da Juliana?",
    ]);
    expect(messages![1].steps).toEqual(["Procurando oportunidades paradas"]);
    expect((await getConversations(db, visitor))[0].id).toBe(first!.id);
  });

  it("isola conversas por visitante (não lê, não continua e não apaga a de outro)", async () => {
    const [own] = await getConversations(db, visitor);
    expect(await getConversationMessages(db, intruder, own.id)).toBeNull();
    expect(await startTurn(db, intruder, own.id, "oi")).toBeNull();
    expect(await removeConversation(db, intruder, own.id)).toBe(false);
  });

  it("a role somente leitura da Iris não acessa o histórico", async () => {
    if (!process.env.DATABASE_URL_READONLY) return;
    const error = await getConversations(readonlyDb, visitor).then(
      () => null,
      (e: unknown) => e as Error & { cause?: Error },
    );
    // O Drizzle embrulha o erro do Postgres; a causa original é "permission denied".
    expect(String(error?.cause?.message ?? error?.message)).toMatch(/permission denied/);
  });

  it("excluir a conversa remove as mensagens em cascata", async () => {
    const [own] = await getConversations(db, visitor);
    expect(await removeConversation(db, visitor, own.id)).toBe(true);
    expect(await getConversationMessages(db, visitor, own.id)).toBeNull();
  });
});
