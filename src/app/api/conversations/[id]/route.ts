import { z } from "zod";
import { db } from "@/server/db/client";
import { handleRoute, HttpError } from "@/server/http";
import { resolveVisitor } from "@/server/iris/visitor";
import { getConversationMessages, removeConversation } from "@/server/services/conversation-service";

const idSchema = z.uuid({ message: "Identificador de conversa inválido" });

export async function GET(request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  return handleRoute(async () => {
    const id = idSchema.parse((await ctx.params).id);
    const messages = await getConversationMessages(db, resolveVisitor(request).id, id);
    if (!messages) throw new HttpError(404, "conversation_not_found", "Conversa não encontrada.");
    return Response.json(messages);
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  return handleRoute(async () => {
    const id = idSchema.parse((await ctx.params).id);
    const removed = await removeConversation(db, resolveVisitor(request).id, id);
    if (!removed) throw new HttpError(404, "conversation_not_found", "Conversa não encontrada.");
    return new Response(null, { status: 204 });
  });
}
