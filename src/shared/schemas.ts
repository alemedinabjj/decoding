import { z } from "zod";
import { STAGES } from "./stages";
import { OPPORTUNITY_SORT_FIELDS, type FilterParams, type OpportunityQuery } from "./types";

// Mensagens de validação em português (são exibidas ao usuário em caso de erro 400).
z.config(z.locales.pt());

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Data inválida");

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const filterParamsSchema = z
  .object({
    startDate: z.preprocess(emptyToUndefined, isoDate.optional()),
    endDate: z.preprocess(emptyToUndefined, isoDate.optional()),
    stage: z.preprocess(emptyToUndefined, z.enum(STAGES).optional()),
    salesRepId: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  })
  .refine((f) => !f.startDate || !f.endDate || f.startDate <= f.endDate, {
    message: "A data inicial deve ser anterior ou igual à data final",
    path: ["endDate"],
  }) satisfies z.ZodType<FilterParams>;

export const opportunityQuerySchema = z
  .object({
    startDate: z.preprocess(emptyToUndefined, isoDate.optional()),
    endDate: z.preprocess(emptyToUndefined, isoDate.optional()),
    stage: z.preprocess(emptyToUndefined, z.enum(STAGES).optional()),
    salesRepId: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
    opportunityId: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    status: z.preprocess(emptyToUndefined, z.enum(["open", "closed"]).optional()),
    staleOnly: z.preprocess(
      (v) => (v === "true" ? true : v === "false" ? false : emptyToUndefined(v)),
      z.boolean().optional(),
    ),
    sort: z.preprocess(emptyToUndefined, z.enum(OPPORTUNITY_SORT_FIELDS).optional()),
    direction: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).optional()),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
    pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional()),
  })
  .refine((f) => !f.startDate || !f.endDate || f.startDate <= f.endDate, {
    message: "A data inicial deve ser anterior ou igual à data final",
    path: ["endDate"],
  }) satisfies z.ZodType<OpportunityQuery>;

export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  return Object.fromEntries(params.entries());
}
