import { db, readonlyDb } from "@/server/db/client";
import { getNow } from "@/server/clock";
import { errorResponse } from "@/server/http";
import { runIris } from "@/server/iris/agent";
import { embedText, getOpenAI, IRIS_MODEL } from "@/server/iris/openai";
import { buildSystemPrompt } from "@/server/iris/prompt";
import { clientKey, consumeRateLimit } from "@/server/iris/rate-limit";
import { findDataCoverage } from "@/server/repositories/lead-repository";
import { listSalesReps } from "@/server/services/opportunity-service";
import { irisChatRequestSchema, type IrisStreamEvent } from "@/shared/iris";

export const maxDuration = 60;

const RATE_LIMIT = Number(process.env.IRIS_RATE_LIMIT_PER_MINUTE ?? 10);

export async function POST(request: Request) {
  const openai = getOpenAI();
  if (!openai) return errorResponse(503, "ai_unavailable", "Serviço de IA não configurado (OPENAI_API_KEY ausente).");

  const parsed = irisChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", parsed.error.issues[0]?.message ?? "Requisição inválida");
  }

  try {
    const limit = await consumeRateLimit(db, clientKey(request.headers), RATE_LIMIT);
    if (!limit.allowed) {
      return errorResponse(429, "rate_limited", "Limite de perguntas por minuto atingido. Aguarde um instante.");
    }
  } catch (error) {
    // Falha no limitador não deve derrubar a Iris (fail-open), apenas ser registrada.
    console.error("[iris] rate limit indisponível:", error);
  }

  const { messages, dashboardFilters } = parsed.data;
  const now = getNow();

  // Toda leitura da Iris usa a conexão do role somente leitura.
  const [coverage, reps] = await Promise.all([findDataCoverage(readonlyDb), listSalesReps(readonlyDb)]);
  const systemPrompt = buildSystemPrompt({
    now,
    coverage,
    dashboardFilters,
    dashboardSalesRepName: reps.find((rep) => rep.id === dashboardFilters?.salesRepId)?.name,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: IrisStreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await runIris({
          client: openai,
          model: IRIS_MODEL,
          systemPrompt,
          messages,
          toolContext: { db: readonlyDb, now, embed: embedText },
          emit,
          signal: request.signal,
        });
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("[iris] falha ao gerar resposta:", error);
          emit({ type: "error", message: "A Iris não conseguiu concluir a resposta. Tente novamente em instantes." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
