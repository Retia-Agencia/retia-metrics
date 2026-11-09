SET lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "oauth_clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"nombre" text NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"obtenido_en" timestamp with time zone DEFAULT now() NOT NULL,
	"bloqueado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_codigos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"scope" "mcp_scope" NOT NULL,
	"resource" text NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"usado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD COLUMN "vence_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD COLUMN "resource" text;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD COLUMN "refresh_hash" text;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD COLUMN "refresh_vence_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD COLUMN "codigo_id" uuid;--> statement-breakpoint
ALTER TABLE "oauth_codigos" ADD CONSTRAINT "oauth_codigos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_clientes_client_id_idx" ON "oauth_clientes" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_codigos_hash_idx" ON "oauth_codigos" USING btree ("hash");--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_codigo_id_oauth_codigos_id_fk" FOREIGN KEY ("codigo_id") REFERENCES "public"."oauth_codigos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_tokens_refresh_hash_idx" ON "mcp_tokens" USING btree ("refresh_hash");--> statement-breakpoint
CREATE INDEX "mcp_tokens_codigo_idx" ON "mcp_tokens" USING btree ("codigo_id");