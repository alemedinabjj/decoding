import type { ApiError, FilterParams, OpportunityQuery } from "@/shared/types";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

type QueryValue = string | number | boolean | undefined | null;

export function toQueryString(params: Record<string, QueryValue> | FilterParams | OpportunityQuery): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

const FALLBACK_MESSAGE = "Não foi possível carregar os dados. Verifique sua conexão e tente novamente.";

export async function apiGet<T>(path: string, params: Record<string, QueryValue> | FilterParams | OpportunityQuery = {}, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${path}${toQueryString(params)}`, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiRequestError(0, FALLBACK_MESSAGE);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(response.status, body?.error.message ?? FALLBACK_MESSAGE, body?.error.code);
  }
  return (await response.json()) as T;
}
