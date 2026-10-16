import { db } from "@/server/db/client";
import { handleRoute, parseSearchParams } from "@/server/http";
import { getFunnel } from "@/server/services/dashboard-service";
import { filterParamsSchema } from "@/shared/schemas";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const filters = parseSearchParams(request, filterParamsSchema);
    return Response.json(await getFunnel(db, filters));
  });
}
