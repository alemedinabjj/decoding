import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../repositories/opportunity-repository";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/** Identificador do cliente: hash do IP (não armazenamos o IP em texto puro). */
export function clientKey(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "anonymous";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Janela fixa de 1 minuto em uma tabela do próprio Postgres: funciona em
 * serverless (várias instâncias) sem depender de Redis.
 */
export async function consumeRateLimit(db: Db, key: string, limit: number): Promise<RateLimitResult> {
  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, date_trunc('minute', now()), 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `);
  const count = Number(result.rows[0]?.count ?? 1);

  // Limpeza ocasional de janelas antigas, sem custo perceptível por requisição.
  if (Math.random() < 0.05) {
    await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 hour'`);
  }

  return { allowed: count <= limit, remaining: Math.max(0, limit - count), limit };
}
