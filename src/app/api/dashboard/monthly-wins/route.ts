import { db } from "@/server/db/client";
import { getNow } from "@/server/clock";
import { handleRoute, parseSearchParams } from "@/server/http";
import { getMonthlyWins } from "@/server/services/dashboard-service";
import { filterParamsSchema } from "@/shared/schemas";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const filters = parseSearchParams(request, filterParamsSchema);
    return Response.json(await getMonthlyWins(db, filters, getNow()));
  });
}
