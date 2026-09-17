ALTER TYPE "public"."resultado_llamada" ADD VALUE 'cancelada' BEFORE 'reagendada';--> statement-breakpoint
ALTER TYPE "public"."resultado_llamada" ADD VALUE 'compromiso_pago' BEFORE 'cerrada';--> statement-breakpoint
CREATE TABLE "abonos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"plataforma_id" uuid,
	"comprobante_url" text,
	"closer_id" text,
	"origen" text DEFAULT 'app' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "fecha_seguimiento" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "motivo_id" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "origen_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "producto_id" uuid;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_plataforma_id_plataformas_pago_id_fk" FOREIGN KEY ("plataforma_id") REFERENCES "public"."plataformas_pago"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abonos_programa_fecha_idx" ON "abonos" USING btree ("program_id","fecha");--> statement-breakpoint
CREATE INDEX "abonos_venta_idx" ON "abonos" USING btree ("sale_id");--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_motivo_id_motivos_id_fk" FOREIGN KEY ("motivo_id") REFERENCES "public"."motivos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_origen_id_origenes_id_fk" FOREIGN KEY ("origen_id") REFERENCES "public"."origenes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- ADR 0013: cada venta vieja con monto_abonado pasa a ser su primer abono. El 17-sep habia 0 ventas en dev y production.
-- Idempotente-seguro: solo copia ventas que aun no tienen ningun abono, asi re-correr no duplica caja. Plataforma nula (no se sabe), origen 'sheets'.
INSERT INTO "abonos" ("sale_id", "program_id", "fecha", "monto", "moneda", "closer_id", "origen", "created_at")
SELECT s."id", s."program_id", COALESCE(s."fecha", (s."created_at" AT TIME ZONE 'America/Bogota')::date), s."monto_abonado", COALESCE(s."moneda", 'USD'), s."closer_id", 'sheets', s."created_at"
FROM "sales" s
WHERE s."monto_abonado" IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM "abonos" a WHERE a."sale_id" = s."id");--> statement-breakpoint
-- ADR 0013 (enmienda 17-sep): si una venta esta pagada se calcula desde abonos, no se guarda.
ALTER TABLE "sales" DROP COLUMN "es_pago_completo";