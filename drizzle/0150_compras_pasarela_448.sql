CREATE TYPE "public"."estado_compra_pasarela" AS ENUM('sin_emparejar', 'emparejada', 'en_revision');--> statement-breakpoint
ALTER TYPE "public"."tipo_integracion" ADD VALUE 'hotmart';--> statement-breakpoint
CREATE TABLE "compras_pasarela" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"integracion_id" uuid NOT NULL,
	"sobre_id" uuid,
	"proveedor" text NOT NULL,
	"transaccion" text NOT NULL,
	"evento" text NOT NULL,
	"estado" "estado_compra_pasarela" NOT NULL,
	"motivo_revision" text,
	"codigo_oferta" text,
	"enlace_pago_id" uuid,
	"cohort_id" uuid,
	"monto" numeric(12, 2),
	"moneda" text,
	"correo" text,
	"telefono" text,
	"nombre" text,
	"lead_id" uuid,
	"emparejada_por" text,
	"nota_sistema" text,
	"asignada_por_user_id" uuid,
	"aprobada_en" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_pasarela_moneda_chk" CHECK ("compras_pasarela"."moneda" is null or "compras_pasarela"."moneda" in ('COP', 'USD')),
	CONSTRAINT "compras_pasarela_emparejada_por_chk" CHECK ("compras_pasarela"."emparejada_por" is null or "compras_pasarela"."emparejada_por" in ('correo', 'telefono', 'manual')),
	CONSTRAINT "compras_pasarela_motivo_revision_chk" CHECK ("compras_pasarela"."motivo_revision" is null or "compras_pasarela"."motivo_revision" in ('oferta_desconocida', 'sin_oferta', 'moneda_no_soportada', 'sin_cohorte', 'cohorte_ambigua'))
);
--> statement-breakpoint
ALTER TABLE "sobres_crudos" DROP CONSTRAINT "sobres_crudos_origen_chk";--> statement-breakpoint
ALTER TABLE "compras_pasarela" ADD CONSTRAINT "compras_pasarela_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_pasarela" ADD CONSTRAINT "compras_pasarela_integracion_id_integraciones_id_fk" FOREIGN KEY ("integracion_id") REFERENCES "public"."integraciones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_pasarela" ADD CONSTRAINT "compras_pasarela_sobre_id_sobres_crudos_id_fk" FOREIGN KEY ("sobre_id") REFERENCES "public"."sobres_crudos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_pasarela" ADD CONSTRAINT "compras_pasarela_enlace_pago_id_enlaces_pago_id_fk" FOREIGN KEY ("enlace_pago_id") REFERENCES "public"."enlaces_pago"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_pasarela" ADD CONSTRAINT "compras_pasarela_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_pasarela" ADD CONSTRAINT "compras_pasarela_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_pasarela" ADD CONSTRAINT "compras_pasarela_asignada_por_user_id_users_id_fk" FOREIGN KEY ("asignada_por_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "compras_pasarela_proveedor_transaccion_idx" ON "compras_pasarela" USING btree ("proveedor","transaccion");--> statement-breakpoint
CREATE INDEX "compras_pasarela_programa_estado_idx" ON "compras_pasarela" USING btree ("program_id","estado");--> statement-breakpoint
ALTER TABLE "sobres_crudos" ADD CONSTRAINT "sobres_crudos_origen_chk" CHECK (("sobres_crudos"."origen" = 'formulario' AND "sobres_crudos"."source_id" IS NOT NULL) OR ("sobres_crudos"."origen" in ('calendly', 'pago') AND "sobres_crudos"."source_id" IS NULL));--> statement-breakpoint
-- ADR 0047: toda tabla de public nace con RLS (sin politicas: anon y authenticated no ven filas).
ALTER TABLE "compras_pasarela" ENABLE ROW LEVEL SECURITY;