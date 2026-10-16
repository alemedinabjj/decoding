CREATE TABLE "iris_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iris_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "iris_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iris_messages" ADD CONSTRAINT "iris_messages_conversation_id_iris_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."iris_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iris_conversations_visitor_idx" ON "iris_conversations" USING btree ("visitor_id","updated_at");--> statement-breakpoint
CREATE INDEX "iris_messages_conversation_idx" ON "iris_messages" USING btree ("conversation_id","id");
--> statement-breakpoint
-- A role da Iris lê apenas dados comerciais: o histórico de conversas não é acessível a ela.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iris_reader') THEN
    REVOKE ALL ON iris_conversations, iris_messages FROM iris_reader;
  END IF;
END $$;
