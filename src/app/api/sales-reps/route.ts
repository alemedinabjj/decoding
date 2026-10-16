import { connection } from "next/server";
import { db } from "@/server/db/client";
import { handleRoute } from "@/server/http";
import { listSalesReps } from "@/server/services/opportunity-service";

export async function GET() {
  await connection();
  return handleRoute(async () => Response.json(await listSalesReps(db)));
}
