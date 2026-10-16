import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Duas conexões com papéis diferentes:
 * - `db`: owner, usada pelas rotas do dashboard e pelo rate limit.
 * - `readonlyDb`: role `iris_reader` (apenas SELECT), usada pelas ferramentas da Iris.
 *   Mesmo que uma ferramenta tentasse escrever, o Postgres recusaria.
 */
function createDb(connectionString: string | undefined, name: string) {
  if (!connectionString) {
    throw new Error(`Variável de ambiente ${name} não configurada.`);
  }
  const pool = new Pool({ connectionString, max: 5 });
  return drizzle(pool, { schema });
}

type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { db?: Db; readonlyDb?: Db };

export const db: Db = globalForDb.db ?? createDb(process.env.DATABASE_URL, "DATABASE_URL");

export const readonlyDb: Db =
  globalForDb.readonlyDb ??
  createDb(process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL, "DATABASE_URL_READONLY");

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
  globalForDb.readonlyDb = readonlyDb;
}

export type Database = Db;
