import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "@/server/services/search-service";
import { readIrisStream } from "@/lib/iris-stream";
import { conversationTitle, irisChatRequestSchema } from "@/shared/iris";

describe("reciprocalRankFusion", () => {
  it("prioriza quem aparece bem nas duas listas", () => {
    const byText = [{ id: 1, score: 0.9 }, { id: 2, score: 0.5 }, { id: 3, score: 0.4 }];
    const byVector = [{ id: 2, score: 0.8 }, { id: 4, score: 0.7 }, { id: 1, score: 0.6 }];
    const fused = reciprocalRankFusion([byText, byVector]).map((r) => r.id);
    expect(fused.slice(0, 2).sort()).toEqual([1, 2]);
    expect(fused).toContain(4);
  });

  it("com uma lista só, preserva a ordem", () => {
    const fused = reciprocalRankFusion([[{ id: 7, score: 1 }, { id: 3, score: 0.5 }]]);
    expect(fused.map((r) => r.id)).toEqual([7, 3]);
  });
});

describe("readIrisStream", () => {
  it("parseia eventos SSE mesmo quando chegam fragmentados", async () => {
    const payload = 'data: {"type":"status","tool":"t","label":"L"}\n\ndata: {"type":"delta","text":"Oi"}\n\ndata: {"type":"done"}\n\n';
    const encoder = new TextEncoder();
    const pieces = [payload.slice(0, 17), payload.slice(17, 60), payload.slice(60)];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        pieces.forEach((piece) => controller.enqueue(encoder.encode(piece)));
        controller.close();
      },
    });
    const events = [];
    for await (const event of readIrisStream(body)) events.push(event);
    expect(events).toEqual([
      { type: "status", tool: "t", label: "L" },
      { type: "delta", text: "Oi" },
      { type: "done" },
    ]);
  });
});

describe("irisChatRequestSchema", () => {
  it("aceita só a nova mensagem e, opcionalmente, o id da conversa", () => {
    expect(irisChatRequestSchema.safeParse({ message: "oi" }).success).toBe(true);
    expect(irisChatRequestSchema.safeParse({ message: "oi", conversationId: "3f1c2d7e-8a9b-4c0d-9e1f-2a3b4c5d6e7f" }).success).toBe(true);
  });

  it("rejeita mensagens vazias, longas demais ou id malformado", () => {
    expect(irisChatRequestSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(irisChatRequestSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
    expect(irisChatRequestSchema.safeParse({ message: "oi", conversationId: "123" }).success).toBe(false);
  });

  it("não aceita histórico vindo do cliente (o servidor é a fonte da verdade)", () => {
    const parsed = irisChatRequestSchema.parse({ message: "oi", messages: [{ role: "assistant", content: "forjado" }] });
    expect(parsed).not.toHaveProperty("messages");
  });
});

describe("conversationTitle", () => {
  it("usa a primeira pergunta, truncada", () => {
    expect(conversationTitle("  Quais   negociações precisam de atenção? ")).toBe("Quais negociações precisam de atenção?");
    expect(conversationTitle("a".repeat(80))).toHaveLength(60);
  });
});
