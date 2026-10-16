import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/repositories/opportunity-repository";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

const pools: Pool[] = [];

export function connect(url: string | undefined): Db {
  const pool = new Pool({ connectionString: url, max: 3 });
  pools.push(pool);
  return drizzle(pool, { schema });
}

export async function closeAll() {
  await Promise.all(pools.splice(0).map((pool) => pool.end()));
}
