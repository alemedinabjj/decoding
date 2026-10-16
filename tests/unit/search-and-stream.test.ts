import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "@/server/services/search-service";
import { readIrisStream } from "@/lib/iris-stream";
import { irisChatRequestSchema } from "@/shared/iris";

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
  it("exige que a última mensagem seja do usuário", () => {
    expect(irisChatRequestSchema.safeParse({ messages: [{ role: "assistant", content: "oi" }] }).success).toBe(false);
  });

  it("rejeita mensagens vazias ou longas demais", () => {
    expect(irisChatRequestSchema.safeParse({ messages: [{ role: "user", content: "   " }] }).success).toBe(false);
    expect(irisChatRequestSchema.safeParse({ messages: [{ role: "user", content: "x".repeat(2001) }] }).success).toBe(false);
  });
});
