-- Ticket 106: el sobre crudo de un envio de webhook que no se pudo procesar. RLS sin politicas
-- como toda tabla de public (ADR 0047, migracion 0021).
CREATE TABLE "sobres_crudos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"cuerpo" text NOT NULL,
	"error" text NOT NULL,
	"recibido_en" timestamp with time zone DEFAULT now() NOT NULL,
	"reprocesado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sobres_crudos" ADD CONSTRAINT "sobres_crudos_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sobres_crudos_pendientes_idx" ON "sobres_crudos" USING btree ("source_id") WHERE "sobres_crudos"."reprocesado_en" is null;--> statement-breakpoint
ALTER TABLE "sobres_crudos" ENABLE ROW LEVEL SECURITY;