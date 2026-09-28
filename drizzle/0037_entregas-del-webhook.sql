CREATE TYPE "public"."motivo_entrega" AS ENUM('procesado', 'sin_correo', 'contenido_invalido', 'fallo_ingesta', 'fuente_no_encontrada', 'sin_secreto', 'firma_ausente', 'firma_invalida');--> statement-breakpoint
CREATE TABLE "entregas_webhook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid,
	"source_id" uuid,
	"sobre_id" uuid,
	"lead_id" uuid,
	"codigo_http" integer NOT NULL,
	"motivo" "motivo_entrega" NOT NULL,
	"recibido_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entregas_webhook_codigo_chk" CHECK ("entregas_webhook"."codigo_http" in (200, 401, 404))
);
--> statement-breakpoint
-- Como toda tabla de public (ADR 0047, migracion 0021): RLS sin politicas, la Data API no la expone.
ALTER TABLE "entregas_webhook" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entregas_webhook" ADD CONSTRAINT "entregas_webhook_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entregas_webhook" ADD CONSTRAINT "entregas_webhook_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entregas_webhook" ADD CONSTRAINT "entregas_webhook_sobre_id_sobres_crudos_id_fk" FOREIGN KEY ("sobre_id") REFERENCES "public"."sobres_crudos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entregas_webhook" ADD CONSTRAINT "entregas_webhook_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entregas_webhook_programa_idx" ON "entregas_webhook" USING btree ("program_id","recibido_en");--> statement-breakpoint
CREATE INDEX "entregas_webhook_recibido_idx" ON "entregas_webhook" USING btree ("recibido_en");