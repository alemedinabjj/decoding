import "server-only";
import { ZodError, type ZodType } from "zod";
import { searchParamsToObject } from "@/shared/schemas";
import type { ApiError } from "@/shared/types";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  const body: ApiError = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return Response.json(body, { status });
}

export function parseSearchParams<T>(request: Request, schema: ZodType<T>): T {
  const params = searchParamsToObject(new URL(request.url).searchParams);
  return schema.parse(params);
}

/**
 * Envolve um route handler: validação (400), erros conhecidos (HttpError) e
 * falhas inesperadas (500, sem vazar detalhes internos para o cliente).
 */
export async function handleRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "invalid_params", error.issues[0]?.message ?? "Parâmetros inválidos", error.issues);
    }
    if (error instanceof HttpError) {
      return errorResponse(error.status, error.code, error.message, error.details);
    }
    console.error("[api] erro inesperado:", error);
    return errorResponse(500, "internal_error", "Não foi possível carregar os dados. Tente novamente em instantes.");
  }
}
