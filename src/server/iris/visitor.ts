import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Identidade anônima do visitante para o histórico da Iris (não há login no case).
 * Cookie httpOnly: o JavaScript da página não lê nem forja o identificador.
 */
export const VISITOR_COOKIE = "decoding_visitor";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Visitor {
  id: string;
  /** Header Set-Cookie a anexar na resposta quando o visitante é novo. */
  setCookie?: string;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function resolveVisitor(request: Request): Visitor {
  const existing = readCookie(request, VISITOR_COOKIE);
  if (existing && UUID_PATTERN.test(existing)) return { id: existing };

  const id = randomUUID();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return {
    id,
    setCookie: `${VISITOR_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`,
  };
}

export function withVisitorCookie(response: Response, visitor: Visitor): Response {
  if (visitor.setCookie) response.headers.append("Set-Cookie", visitor.setCookie);
  return response;
}
