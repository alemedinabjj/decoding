import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { STAGES } from "../../shared/stages";

export const EMBEDDING_DIMENSIONS = 1536;

export const stageEnum = pgEnum("stage", STAGES);

export const salesReps = pgTable("sales_reps", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leads = pgTable(
  "leads",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    segment: text("segment").notNull(),
    description: text("description").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leads_company_trgm_idx").using("gin", sql`${t.companyName} gin_trgm_ops`),
    index("leads_contact_trgm_idx").using("gin", sql`${t.contactName} gin_trgm_ops`),
    index("leads_embedding_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "restrict" }),
    salesRepId: integer("sales_rep_id")
      .notNull()
      .references(() => salesReps.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    /** Valor estimado em centavos — inteiro evita erros de ponto flutuante. */
    valueCents: bigint("value_cents", { mode: "number" }).notNull(),
    stage: stageEnum("stage").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("opportunities_created_at_idx").on(t.createdAt),
    index("opportunities_updated_at_idx").on(t.updatedAt),
    index("opportunities_stage_idx").on(t.stage),
    index("opportunities_sales_rep_idx").on(t.salesRepId),
    index("opportunities_lead_idx").on(t.leadId),
  ],
);

/** Contador de requisições por chave (IP) e janela de tempo — rate limit da Iris. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/**
 * Histórico de conversas da Iris, por visitante anônimo (cookie httpOnly).
 * Escrito pela aplicação — as ferramentas da IA continuam somente leitura.
 */
export const irisConversations = pgTable(
  "iris_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitorId: text("visitor_id").notNull(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("iris_conversations_visitor_idx").on(t.visitorId, t.updatedAt)],
);

export const irisMessages = pgTable(
  "iris_messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => irisConversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    /** Consultas feitas pela Iris para produzir a resposta (rótulos exibidos ao usuário). */
    steps: jsonb("steps").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("iris_messages_conversation_idx").on(t.conversationId, t.id)],
);

export type SalesRepRow = typeof salesReps.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;
export type OpportunityRow = typeof opportunities.$inferSelect;
