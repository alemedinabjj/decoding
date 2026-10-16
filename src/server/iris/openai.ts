import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

/** Cliente da OpenAI — existe apenas no servidor; a chave nunca chega ao navegador. */
export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client ??= new OpenAI({ apiKey, timeout: 45_000, maxRetries: 1 });
  return client;
}

export const IRIS_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export async function embedText(text: string): Promise<number[] | null> {
  const openai = getOpenAI();
  if (!openai) return null;
  const response = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return response.data[0]?.embedding ?? null;
}
