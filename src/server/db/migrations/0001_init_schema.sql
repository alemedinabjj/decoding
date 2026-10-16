CREATE TYPE "public"."stage" AS ENUM('novo_contato', 'qualificacao', 'proposta_enviada', 'negociacao', 'ganho', 'perdido');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"segment" text NOT NULL,
	"description" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "opportunities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lead_id" integer NOT NULL,
	"sales_rep_id" integer NOT NULL,
	"name" text NOT NULL,
	"value_cents" bigint NOT NULL,
	"stage" "stage" NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sales_reps" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_reps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_reps_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_sales_rep_id_sales_reps_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_company_trgm_idx" ON "leads" USING gin ("company_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "leads_contact_trgm_idx" ON "leads" USING gin ("contact_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "leads_embedding_hnsw_idx" ON "leads" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "opportunities_created_at_idx" ON "opportunities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "opportunities_updated_at_idx" ON "opportunities" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "opportunities_stage_idx" ON "opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "opportunities_sales_rep_idx" ON "opportunities" USING btree ("sales_rep_id");--> statement-breakpoint
CREATE INDEX "opportunities_lead_idx" ON "opportunities" USING btree ("lead_id");