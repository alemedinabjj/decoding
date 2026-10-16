import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IrisStreamEvent } from "@/shared/iris";

vi.mock("@/server/iris/tools", () => ({
  IRIS_TOOL_DEFINITIONS: [],
  toolLabel: (name: string) => `label:${name}`,
  runTool: vi.fn(async (name: string) => JSON.stringify({ ok: name })),
}));

const { runIris, MAX_AGENT_STEPS } = await import("@/server/iris/agent");
const { runTool } = await import("@/server/iris/tools");

type Chunk = { choices: { delta: Record<string, unknown> }[] };

function streamOf(chunks: Chunk[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

const toolCallChunks = (name: string, args: string): Chunk[] => [
  { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name, arguments: "" } }] } }] },
  { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: args } }] } }] },
];

const textChunks = (...parts: string[]): Chunk[] => parts.map((content) => ({ choices: [{ delta: { content } }] }));

function fakeClient(responses: Chunk[][]) {
  const create = vi.fn(async () => streamOf(responses.shift() ?? textChunks("fim")));
  return { client: { chat: { completions: { create } } } as never, create };
}

async function collect(client: never) {
  const events: IrisStreamEvent[] = [];
  await runIris({
    client,
    model: "test",
    systemPrompt: "sys",
    messages: [{ role: "user", content: "pergunta" }],
    toolContext: { db: {} as never, now: new Date() },
    emit: (e) => events.push(e),
  });
  return events;
}

describe("runIris", () => {
  beforeEach(() => vi.mocked(runTool).mockClear());

  it("responde direto quando o modelo não pede ferramentas", async () => {
    const { client } = fakeClient([textChunks("Olá", ", tudo bem?")]);
    const events = await collect(client);
    expect(events).toEqual([
      { type: "delta", text: "Olá" },
      { type: "delta", text: ", tudo bem?" },
      { type: "done" },
    ]);
  });

  it("executa a ferramenta pedida, emite status e devolve o resultado ao modelo", async () => {
    const { client, create } = fakeClient([toolCallChunks("get_metrics", '{"stage":"ganho"}'), textChunks("São 32 vendas.")]);
    const events = await collect(client);

    expect(runTool).toHaveBeenCalledWith("get_metrics", '{"stage":"ganho"}', expect.anything());
    expect(events[0]).toEqual({ type: "status", tool: "get_metrics", label: "label:get_metrics" });
    expect(events.at(-1)).toEqual({ type: "done" });

    const secondCallMessages = (create.mock.calls[1] as unknown as [{ messages: { role: string }[] }])[0].messages;
    expect(secondCallMessages.map((m) => m.role)).toEqual(["system", "user", "assistant", "tool"]);
  });

  it("interrompe após o limite de etapas para não entrar em loop", async () => {
    const responses = Array.from({ length: MAX_AGENT_STEPS + 2 }, () => toolCallChunks("get_metrics", "{}"));
    const { client, create } = fakeClient(responses);
    const events = await collect(client);
    expect(create).toHaveBeenCalledTimes(MAX_AGENT_STEPS);
    expect(events.at(-1)).toEqual({ type: "done" });
  });
});
