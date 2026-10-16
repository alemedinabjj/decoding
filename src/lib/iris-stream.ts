import type { IrisStreamEvent } from "@/shared/iris";

/**
 * Lê um corpo `text/event-stream` e devolve os eventos já parseados.
 * Implementação mínima de SSE: blocos separados por linha em branco, linhas `data:`.
 */
export async function* readIrisStream(body: ReadableStream<Uint8Array>): AsyncGenerator<IrisStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) yield JSON.parse(data) as IrisStreamEvent;
        separator = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
