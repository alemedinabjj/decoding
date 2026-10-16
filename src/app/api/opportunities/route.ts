import { db } from "@/server/db/client";
import { getNow } from "@/server/clock";
import { handleRoute, parseSearchParams } from "@/server/http";
import { listOpportunities } from "@/server/services/opportunity-service";
import { opportunityQuerySchema } from "@/shared/schemas";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const query = parseSearchParams(request, opportunityQuerySchema);
    return Response.json(await listOpportunities(db, query, getNow()));
  });
}
