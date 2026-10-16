/**
 * Loop do agente: o modelo responde ou pede ferramentas; executamos as
 * ferramentas (somente leitura) e devolvemos o resultado, até a resposta final.
 * Os eventos são emitidos em tempo real para o cliente (status + texto).
 */
import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { IrisChatMessage, IrisStreamEvent } from "../../shared/iris";
import { IRIS_TOOL_DEFINITIONS, runTool, toolLabel, type IrisToolContext } from "./tools";

export const MAX_AGENT_STEPS = 6;

export type ChatClient = Pick<OpenAI, "chat">;

export interface RunIrisOptions {
  client: ChatClient;
  model: string;
  systemPrompt: string;
  messages: IrisChatMessage[];
  toolContext: IrisToolContext;
  emit: (event: IrisStreamEvent) => void;
  signal?: AbortSignal;
}

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

export async function runIris({ client, model, systemPrompt, messages, toolContext, emit, signal }: RunIrisOptions): Promise<void> {
  const conversation: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
  ];

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const stream = await client.chat.completions.create(
      {
        model,
        messages: conversation,
        tools: IRIS_TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0,
        stream: true,
      },
      { signal },
    );

    let content = "";
    const toolCalls = new Map<number, PendingToolCall>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        emit({ type: "delta", text: delta.content });
      }
      for (const call of delta.tool_calls ?? []) {
        const pending = toolCalls.get(call.index) ?? { id: "", name: "", arguments: "" };
        if (call.id) pending.id = call.id;
        if (call.function?.name) pending.name += call.function.name;
        if (call.function?.arguments) pending.arguments += call.function.arguments;
        toolCalls.set(call.index, pending);
      }
    }

    if (toolCalls.size === 0) {
      emit({ type: "done" });
      return;
    }

    const calls = [...toolCalls.values()];
    conversation.push({
      role: "assistant",
      content: content || null,
      tool_calls: calls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.arguments } })),
    });

    // Ferramentas independentes rodam em paralelo; o status aparece para o usuário.
    calls.forEach((call) => emit({ type: "status", tool: call.name, label: toolLabel(call.name) }));
    const results = await Promise.all(calls.map((call) => runTool(call.name, call.arguments, toolContext)));
    calls.forEach((call, index) => conversation.push({ role: "tool", tool_call_id: call.id, content: results[index] }));
  }

  emit({ type: "delta", text: "\n\nNão consegui concluir a análise com segurança. Tente reformular a pergunta de forma mais específica." });
  emit({ type: "done" });
}
