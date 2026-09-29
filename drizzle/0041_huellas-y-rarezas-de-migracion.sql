-- ADR 0059 y ticket 080: huella de la migracion de las pestañas de gestion en deals y abonos,
-- y la lista de rarezas. Solo AGREGA: columnas nulas, una tabla vacia e indices sobre columnas
-- nuevas (todas nulas hoy, asi que los indices unicos no pueden chocar con datos existentes).
CREATE TABLE "rarezas_migracion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"huella" text NOT NULL,
	"tipo" text NOT NULL,
	"detalle" text NOT NULL,
	"lead_id" uuid,
	"deal_id" uuid,
	"abono_id" uuid,
	"call_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rarezas_migracion_detalle_chk" CHECK (length(trim("rarezas_migracion"."detalle")) > 0)
);
--> statement-breakpoint
-- Como toda tabla de public (ADR 0047, migracion 0021): RLS sin politicas, la Data API no la expone.
ALTER TABLE "rarezas_migracion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "huella_migracion" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "huella_migracion" text;--> statement-breakpoint
ALTER TABLE "rarezas_migracion" ADD CONSTRAINT "rarezas_migracion_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rarezas_migracion" ADD CONSTRAINT "rarezas_migracion_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rarezas_migracion" ADD CONSTRAINT "rarezas_migracion_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rarezas_migracion" ADD CONSTRAINT "rarezas_migracion_abono_id_abonos_id_fk" FOREIGN KEY ("abono_id") REFERENCES "public"."abonos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rarezas_migracion" ADD CONSTRAINT "rarezas_migracion_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rarezas_migracion_huella_tipo_idx" ON "rarezas_migracion" USING btree ("huella","tipo");--> statement-breakpoint
CREATE INDEX "rarezas_migracion_programa_idx" ON "rarezas_migracion" USING btree ("program_id","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "abonos_huella_migracion_idx" ON "abonos" USING btree ("huella_migracion") WHERE "abonos"."huella_migracion" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "deals_huella_migracion_idx" ON "deals" USING btree ("huella_migracion") WHERE "deals"."huella_migracion" is not null;