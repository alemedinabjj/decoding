"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowUp, Loader2, RotateCw, Sparkles, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { IRIS_MAX_MESSAGE_LENGTH } from "@/shared/iris";
import type { FilterParams } from "@/shared/types";
import { useIris, type IrisMessage } from "./iris-provider";
import { Markdown } from "./markdown";

export const IRIS_SUGGESTIONS = [
  "Quais negociações precisam de atenção?",
  "Qual o valor total das oportunidades abertas?",
  "Quais são as 3 maiores oportunidades abertas?",
  "Quantas oportunidades estão em negociação?",
  "Em qual etapa do funil estamos perdendo mais?",
];

function AssistantAvatar() {
  return (
    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-navy text-brand-lime ring-1 ring-border dark:bg-brand-lime dark:text-brand-navy">
      <Sparkles className="size-3.5" />
    </span>
  );
}

function ThinkingIndicator({ steps }: { steps: string[] }) {
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Iris está analisando os dados...
      </p>
      {steps.length > 0 && (
        <ul className="space-y-1 pl-5.5 text-xs text-muted-foreground">
          {steps.map((step) => (
            <li key={step} className="list-disc">
              {step}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageBubble({ message, onRetry, isLast }: { message: IrisMessage; onRetry: () => void; isLast: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  const thinking = message.status === "streaming" && !message.content;
  return (
    <div className="flex gap-2.5">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 space-y-2 pt-0.5 text-sm">
        {thinking ? <ThinkingIndicator steps={message.steps} /> : message.content ? <Markdown>{message.content}</Markdown> : null}
        {message.status === "streaming" && message.content && (
          <span aria-hidden className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-foreground/60 align-middle" />
        )}
        {message.status === "error" && (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {message.error}
            </p>
            {isLast && (
              <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
                <RotateCw className="size-3.5" /> Tentar novamente
              </Button>
            )}
          </div>
        )}
        {message.status !== "streaming" && message.steps.length > 0 && (
          <p className="text-xs text-muted-foreground">Fontes consultadas: {message.steps.join(" · ")}</p>
        )}
      </div>
    </div>
  );
}

export function IrisChat({ dashboardFilters, compact = false }: { dashboardFilters?: FilterParams; compact?: boolean }) {
  const { messages, isBusy, send, retryLast, stop, reset } = useIris();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (text: string) => {
    if (!text.trim() || isBusy) return;
    void send(text, dashboardFilters);
    setInput("");
    textareaRef.current?.focus();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(input);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(input);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <div className={cn("mx-auto flex max-w-xl flex-col items-center gap-4 text-center", compact ? "pt-6" : "pt-12")}>
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-navy text-brand-lime dark:bg-brand-lime dark:text-brand-navy">
              <Sparkles className="size-6" />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Olá! Eu sou a Iris.</h2>
              <p className="text-sm text-muted-foreground">
                Respondo perguntas sobre leads, oportunidades e o funil com base nos dados reais do CRM, e indico o que merece atenção.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {IRIS_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  className="rounded-full border bg-card px-3 py-1.5 text-left text-xs transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((message, index) => (
              <MessageBubble key={message.id} message={message} onRetry={retryLast} isLast={index === messages.length - 1} />
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t bg-background/60 p-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <label htmlFor="iris-input" className="sr-only">
            Mensagem para a Iris
          </label>
          <Textarea
            id="iris-input"
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Pergunte sobre o pipeline, metas, oportunidades paradas..."
            rows={1}
            maxLength={IRIS_MAX_MESSAGE_LENGTH}
            className="max-h-36 min-h-10 resize-none"
          />
          {isBusy ? (
            <Button type="button" variant="outline" size="icon-lg" onClick={stop} aria-label="Interromper resposta">
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon-lg" disabled={!input.trim()} aria-label="Enviar mensagem">
              <ArrowUp />
            </Button>
          )}
        </div>
        <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>Somente leitura · respostas baseadas nos dados do CRM</span>
          {messages.length > 0 && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded hover:text-foreground">
              <Trash2 className="size-3" /> Nova conversa
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
