"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { readIrisStream } from "@/lib/iris-stream";
import { IRIS_MAX_MESSAGES, type IrisChatMessage } from "@/shared/iris";
import type { FilterParams } from "@/shared/types";

export interface IrisMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Etapas de consulta mostradas enquanto a Iris trabalha ("Consultando..."). */
  steps: string[];
  status: "streaming" | "done" | "error";
  error?: string;
}

type Action =
  | { type: "start"; user: IrisMessage; assistant: IrisMessage }
  | { type: "step"; id: string; label: string }
  | { type: "delta"; id: string; text: string }
  | { type: "finish"; id: string }
  | { type: "fail"; id: string; error: string }
  | { type: "reset" };

function reducer(state: IrisMessage[], action: Action): IrisMessage[] {
  switch (action.type) {
    case "start":
      return [...state, action.user, action.assistant];
    case "step":
      return state.map((m) => (m.id === action.id && !m.steps.includes(action.label) ? { ...m, steps: [...m.steps, action.label] } : m));
    case "delta":
      return state.map((m) => (m.id === action.id ? { ...m, content: m.content + action.text } : m));
    case "finish":
      return state.map((m) => (m.id === action.id ? { ...m, status: "done" } : m));
    case "fail":
      return state.map((m) => (m.id === action.id ? { ...m, status: "error", error: action.error } : m));
    case "reset":
      return [];
  }
}

interface IrisContextValue {
  messages: IrisMessage[];
  isBusy: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** Envia uma pergunta. `dashboardFilters` dá contexto quando a pergunta vem do painel. */
  send: (text: string, dashboardFilters?: FilterParams) => Promise<void>;
  /** Abre o painel lateral já enviando uma pergunta (ex.: "Perguntar à Iris" na tabela). */
  askFromDashboard: (text: string, dashboardFilters?: FilterParams) => void;
  retryLast: () => void;
  stop: () => void;
  reset: () => void;
}

const IrisContext = createContext<IrisContextValue | null>(null);

let counter = 0;
const nextId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

function errorMessageFor(status: number): string {
  if (status === 429) return "Você atingiu o limite de perguntas por minuto. Aguarde um instante e tente novamente.";
  if (status === 503) return "A Iris está indisponível no momento (serviço de IA não configurado).";
  if (status === 400) return "Não consegui entender essa mensagem. Tente reformular.";
  return "A Iris não conseguiu responder agora. Tente novamente.";
}

export function IrisProvider({ children }: { children: ReactNode }) {
  const [messages, dispatch] = useReducer(reducer, []);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<IrisMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const lastRequestRef = useRef<{ text: string; filters?: FilterParams } | null>(null);

  const send = useCallback(async (text: string, dashboardFilters?: FilterParams) => {
    const content = text.trim();
    if (!content || abortRef.current) return;

    lastRequestRef.current = { text: content, filters: dashboardFilters };
    const user: IrisMessage = { id: nextId(), role: "user", content, steps: [], status: "done" };
    const assistant: IrisMessage = { id: nextId(), role: "assistant", content: "", steps: [], status: "streaming" };

    // Histórico enviado: apenas mensagens concluídas com conteúdo, limitado às mais recentes.
    const history: IrisChatMessage[] = messagesRef.current
      .filter((m) => m.status === "done" && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));
    const payload = [...history, { role: "user" as const, content }].slice(-IRIS_MAX_MESSAGES);

    dispatch({ type: "start", user, assistant });
    const controller = new AbortController();
    abortRef.current = controller;
    setIsBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload, dashboardFilters }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        dispatch({ type: "fail", id: assistant.id, error: errorMessageFor(response.status) });
        return;
      }
      let finished = false;
      for await (const event of readIrisStream(response.body)) {
        if (event.type === "status") dispatch({ type: "step", id: assistant.id, label: event.label });
        else if (event.type === "delta") dispatch({ type: "delta", id: assistant.id, text: event.text });
        else if (event.type === "error") {
          dispatch({ type: "fail", id: assistant.id, error: event.message });
          finished = true;
        } else if (event.type === "done") {
          dispatch({ type: "finish", id: assistant.id });
          finished = true;
        }
      }
      if (!finished) dispatch({ type: "fail", id: assistant.id, error: "A resposta foi interrompida. Tente novamente." });
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      dispatch({
        type: aborted ? "finish" : "fail",
        id: assistant.id,
        error: "Falha de conexão com a Iris. Verifique sua internet e tente novamente.",
      });
    } finally {
      abortRef.current = null;
      setIsBusy(false);
    }
  }, []);

  const askFromDashboard = useCallback(
    (text: string, dashboardFilters?: FilterParams) => {
      setPanelOpen(true);
      void send(text, dashboardFilters);
    },
    [send],
  );

  const retryLast = useCallback(() => {
    const last = lastRequestRef.current;
    if (last) void send(last.text, last.filters);
  }, [send]);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  const value = useMemo(
    () => ({ messages, isBusy, panelOpen, setPanelOpen, send, askFromDashboard, retryLast, stop, reset }),
    [messages, isBusy, panelOpen, send, askFromDashboard, retryLast, stop, reset],
  );

  return <IrisContext.Provider value={value}>{children}</IrisContext.Provider>;
}

export function useIris(): IrisContextValue {
  const context = useContext(IrisContext);
  if (!context) throw new Error("useIris deve ser usado dentro de <IrisProvider>");
  return context;
}
