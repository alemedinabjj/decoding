import { db } from "@/server/db/client";
import { handleRoute } from "@/server/http";
import { listSalesReps } from "@/server/services/opportunity-service";

export async function GET() {
  return handleRoute(async () => Response.json(await listSalesReps(db)));
}
