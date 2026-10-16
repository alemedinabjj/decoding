import { db } from "@/server/db/client";
import { handleRoute } from "@/server/http";
import { resolveVisitor, withVisitorCookie } from "@/server/iris/visitor";
import { getConversations } from "@/server/services/conversation-service";

/** Conversas do visitante atual (identificado pelo cookie anônimo), das mais recentes. */
export async function GET(request: Request) {
  const visitor = resolveVisitor(request);
  return withVisitorCookie(await handleRoute(async () => Response.json(await getConversations(db, visitor.id))), visitor);
}
