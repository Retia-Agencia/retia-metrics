-- Ticket 245. Las fotos del gasto de hoy por campana, y dos origenes nuevos de corrida (endpoint y hub). El CHECK
-- se ensancha (las filas viejas lo cumplen); las FK y el ALTER piden candado breve, por eso el lock_timeout.
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "fotos_pauta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tomada_en" timestamp with time zone NOT NULL,
	"fecha" date NOT NULL,
	"program_id" uuid NOT NULL,
	"campana_id" uuid NOT NULL,
	"gasto" numeric(14, 2) NOT NULL,
	"moneda" text NOT NULL,
	"agendas_meta" integer,
	CONSTRAINT "fotos_pauta_gasto_chk" CHECK ("fotos_pauta"."gasto" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pauta_sincronizaciones" DROP CONSTRAINT "pauta_sincronizaciones_disparada_por_chk";--> statement-breakpoint
ALTER TABLE "fotos_pauta" ADD CONSTRAINT "fotos_pauta_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotos_pauta" ADD CONSTRAINT "fotos_pauta_campana_id_pauta_objetos_id_fk" FOREIGN KEY ("campana_id") REFERENCES "public"."pauta_objetos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fotos_pauta_campana_tomada_idx" ON "fotos_pauta" USING btree ("campana_id","tomada_en");--> statement-breakpoint
CREATE INDEX "fotos_pauta_programa_fecha_idx" ON "fotos_pauta" USING btree ("program_id","fecha","tomada_en");--> statement-breakpoint
CREATE INDEX "fotos_pauta_tomada_idx" ON "fotos_pauta" USING btree ("tomada_en");--> statement-breakpoint
ALTER TABLE "pauta_sincronizaciones" ADD CONSTRAINT "pauta_sincronizaciones_disparada_por_chk" CHECK ("pauta_sincronizaciones"."disparada_por" in ('cron', 'manual', 'endpoint', 'hub'));--> statement-breakpoint
ALTER TABLE "fotos_pauta" ENABLE ROW LEVEL SECURITY;