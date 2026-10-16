"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readIrisStream } from "@/lib/iris-stream";
import { apiGet, ApiRequestError } from "@/lib/api-client";
import type { IrisStoredMessage } from "@/shared/iris";
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
  | { type: "load"; messages: IrisMessage[] }
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
    case "load":
      return action.messages;
    case "reset":
      return [];
  }
}

interface IrisContextValue {
  messages: IrisMessage[];
  conversationId: string | null;
  isBusy: boolean;
  isLoadingConversation: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** Envia uma pergunta. `dashboardFilters` dá contexto quando a pergunta vem do painel. */
  send: (text: string, dashboardFilters?: FilterParams) => Promise<void>;
  /** Abre o painel lateral já enviando uma pergunta (ex.: "Perguntar à Iris" na tabela). */
  askFromDashboard: (text: string, dashboardFilters?: FilterParams) => void;
  openConversation: (id: string) => Promise<void>;
  newConversation: () => void;
  forgetConversation: (id: string) => void;
  retryLast: () => void;
  stop: () => void;
}

const IrisContext = createContext<IrisContextValue | null>(null);

export const IRIS_CONVERSATIONS_KEY = ["iris", "conversations"] as const;
const CURRENT_KEY = "decoding:iris-conversation";

let counter = 0;
const nextId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

function errorMessageFor(status: number): string {
  if (status === 429) return "Você atingiu o limite de perguntas por minuto. Aguarde um instante e tente novamente.";
  if (status === 503) return "A Iris está indisponível no momento (serviço de IA não configurado).";
  if (status === 404) return "Esta conversa não existe mais. Inicie uma nova conversa.";
  if (status === 400) return "Não consegui entender essa mensagem. Tente reformular.";
  return "A Iris não conseguiu responder agora. Tente novamente.";
}

function storeCurrent(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CURRENT_KEY, id);
    else window.localStorage.removeItem(CURRENT_KEY);
  } catch {
    /* armazenamento indisponível: a conversa atual só não é restaurada após recarregar */
  }
}

export function IrisProvider({ children }: { children: ReactNode }) {
  const [messages, dispatch] = useReducer(reducer, []);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<string | null>(null);
  const lastRequestRef = useRef<{ text: string; filters?: FilterParams } | null>(null);
  const queryClient = useQueryClient();

  const selectConversation = useCallback((id: string | null) => {
    conversationRef.current = id;
    setConversationId(id);
    storeCurrent(id);
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      setIsLoadingConversation(true);
      try {
        const stored = await apiGet<IrisStoredMessage[]>(`/api/conversations/${id}`);
        selectConversation(id);
        dispatch({
          type: "load",
          messages: stored.map((m) => ({ id: `s${m.id}`, role: m.role, content: m.content, steps: m.steps, status: "done" })),
        });
      } catch (error) {
        // Conversa apagada ou de outro navegador: volta para uma conversa nova.
        if (error instanceof ApiRequestError && error.status === 404) {
          selectConversation(null);
          dispatch({ type: "reset" });
        }
        throw error;
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [selectConversation],
  );

  // Restaura a última conversa aberta neste navegador.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(CURRENT_KEY);
    } catch {
      saved = null;
    }
    // Sincroniza com um sistema externo (localStorage + API) após a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) openConversation(saved).catch(() => undefined);
  }, [openConversation]);

  const send = useCallback(
    async (text: string, dashboardFilters?: FilterParams) => {
      const content = text.trim();
      if (!content || abortRef.current) return;

      lastRequestRef.current = { text: content, filters: dashboardFilters };
      const user: IrisMessage = { id: nextId(), role: "user", content, steps: [], status: "done" };
      const assistant: IrisMessage = { id: nextId(), role: "assistant", content: "", steps: [], status: "streaming" };

      dispatch({ type: "start", user, assistant });
      const controller = new AbortController();
      abortRef.current = controller;
      setIsBusy(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: conversationRef.current ?? undefined, message: content, dashboardFilters }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          if (response.status === 404) selectConversation(null);
          dispatch({ type: "fail", id: assistant.id, error: errorMessageFor(response.status) });
          return;
        }
        let finished = false;
        for await (const event of readIrisStream(response.body)) {
          if (event.type === "conversation") {
            selectConversation(event.id);
            void queryClient.invalidateQueries({ queryKey: IRIS_CONVERSATIONS_KEY });
          } else if (event.type === "status") dispatch({ type: "step", id: assistant.id, label: event.label });
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
        void queryClient.invalidateQueries({ queryKey: IRIS_CONVERSATIONS_KEY });
      }
    },
    [queryClient, selectConversation],
  );

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

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    selectConversation(null);
    dispatch({ type: "reset" });
  }, [selectConversation]);

  const forgetConversation = useCallback(
    (id: string) => {
      if (conversationRef.current === id) newConversation();
    },
    [newConversation],
  );

  const value = useMemo(
    () => ({
      messages,
      conversationId,
      isBusy,
      isLoadingConversation,
      panelOpen,
      setPanelOpen,
      send,
      askFromDashboard,
      openConversation,
      newConversation,
      forgetConversation,
      retryLast,
      stop,
    }),
    [messages, conversationId, isBusy, isLoadingConversation, panelOpen, send, askFromDashboard, openConversation, newConversation, forgetConversation, retryLast, stop],
  );

  return <IrisContext.Provider value={value}>{children}</IrisContext.Provider>;
}

export function useIris(): IrisContextValue {
  const context = useContext(IrisContext);
  if (!context) throw new Error("useIris deve ser usado dentro de <IrisProvider>");
  return context;
}
