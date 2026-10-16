import { z } from "zod";
import { filterParamsSchema } from "./schemas";

export const IRIS_MAX_MESSAGES = 20;
export const IRIS_MAX_MESSAGE_LENGTH = 2000;

export const irisChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(IRIS_MAX_MESSAGE_LENGTH),
      }),
    )
    .min(1)
    .max(IRIS_MAX_MESSAGES)
    .refine((messages) => messages.at(-1)?.role === "user", "A última mensagem deve ser do usuário"),
  /** Filtros que o usuário está vendo no dashboard, quando a Iris é aberta pelo painel. */
  dashboardFilters: filterParamsSchema.optional(),
});

export type IrisChatRequest = z.infer<typeof irisChatRequestSchema>;
export type IrisChatMessage = IrisChatRequest["messages"][number];

/** Eventos enviados pelo servidor via Server-Sent Events (`data: <json>\n\n`). */
export type IrisStreamEvent =
  | { type: "status"; tool: string; label: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
