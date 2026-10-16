/**
 * Verifica que a conexão da Iris (DATABASE_URL_READONLY) só consegue ler.
 * Uso: npm run db:check-readonly
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

async function attempt(pool: Pool, label: string, query: string) {
  try {
    const result = await pool.query(query);
    console.log(`✓ ${label}: permitido (${result.rowCount ?? 0} linhas)`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`✗ ${label}: bloqueado — ${message}`);
    return false;
  }
}

async function main() {
  const url = process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("DATABASE_URL_READONLY não configurada.");
  const pool = new Pool({ connectionString: url });

  const canRead = await attempt(pool, "SELECT", "SELECT id FROM opportunities LIMIT 1");
  const canUpdate = await attempt(pool, "UPDATE", "UPDATE opportunities SET notes = notes WHERE id = 1");
  const canDelete = await attempt(pool, "DELETE", "DELETE FROM opportunities WHERE id = -1");
  const canCreate = await attempt(pool, "CREATE TABLE", "CREATE TABLE iris_should_not_exist (id int)");
  await pool.end();

  const ok = canRead && !canUpdate && !canDelete && !canCreate;
  console.log(ok ? "\nRole somente leitura confirmado." : "\nATENÇÃO: a role tem permissões além de leitura!");
  process.exit(ok ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
