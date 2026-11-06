-- MCP del CRM (ADR 0119, ticket 348): tokens y bitacora de llamadas. Solo tablas nuevas.
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."mcp_resultado" AS ENUM('ok', 'error', 'denegado', 'tope');--> statement-breakpoint
CREATE TYPE "public"."mcp_scope" AS ENUM('lectura', 'escritura');--> statement-breakpoint
CREATE TYPE "public"."mcp_token_tipo" AS ENUM('personal', 'oauth');--> statement-breakpoint
CREATE TABLE "mcp_llamadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_id_vista" uuid,
	"herramienta" text NOT NULL,
	"program_id" uuid,
	"resultado" "mcp_resultado" NOT NULL,
	"codigo_error" text,
	"duracion_ms" integer,
	"cliente" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"hash" text NOT NULL,
	"scope" "mcp_scope" DEFAULT 'lectura' NOT NULL,
	"tipo" "mcp_token_tipo" DEFAULT 'personal' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso_en" timestamp with time zone,
	"revocado_en" timestamp with time zone,
	"revocado_por_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "mcp_llamadas" ADD CONSTRAINT "mcp_llamadas_token_id_mcp_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."mcp_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_llamadas" ADD CONSTRAINT "mcp_llamadas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_llamadas" ADD CONSTRAINT "mcp_llamadas_user_id_vista_users_id_fk" FOREIGN KEY ("user_id_vista") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_llamadas" ADD CONSTRAINT "mcp_llamadas_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_revocado_por_user_id_users_id_fk" FOREIGN KEY ("revocado_por_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_llamadas_token_creado_idx" ON "mcp_llamadas" USING btree ("token_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_tokens_hash_idx" ON "mcp_tokens" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "mcp_tokens_user_idx" ON "mcp_tokens" USING btree ("user_id");--> statement-breakpoint
-- RLS en toda tabla de public (ADR 0047), como la 0114.
ALTER TABLE "mcp_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mcp_llamadas" ENABLE ROW LEVEL SECURITY;
