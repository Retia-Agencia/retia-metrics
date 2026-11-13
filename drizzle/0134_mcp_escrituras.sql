SET lock_timeout = '5s';--> statement-breakpoint
ALTER TYPE "public"."origen_cambio" ADD VALUE 'mcp';--> statement-breakpoint
CREATE TABLE "mcp_vistas_previas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"accion" text NOT NULL,
	"argumentos" jsonb NOT NULL,
	"huellas" jsonb NOT NULL,
	"vista_previa" jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"confirmada_en" timestamp with time zone,
	"resultado" jsonb,
	CONSTRAINT "mcp_vistas_previas_vence_despues" CHECK ("mcp_vistas_previas"."vence_en" > "mcp_vistas_previas"."creado_en")
);
--> statement-breakpoint
ALTER TABLE "mcp_vistas_previas" ADD CONSTRAINT "mcp_vistas_previas_token_id_mcp_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."mcp_tokens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_vistas_previas" ADD CONSTRAINT "mcp_vistas_previas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_vistas_previas" ADD CONSTRAINT "mcp_vistas_previas_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_vistas_previas_vence_idx" ON "mcp_vistas_previas" USING btree ("vence_en");