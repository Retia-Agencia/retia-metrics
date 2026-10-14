-- Ticket 122. Los objetivos de la cohorte (meta y aceptable por metrica y area). La FK hacia cohorts pide un
-- candado breve, por eso el lock_timeout.
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."metrica_objetivo" AS ENUM('cupos', 'agendas_por_dia', 'costo_por_agenda', 'costo_por_lead', 'costo_por_venta', 'roas', 'conversion_agenda_venta');--> statement-breakpoint
CREATE TABLE "objetivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"area" text,
	"metrica" "metrica_objetivo" NOT NULL,
	"meta" numeric(14, 2) NOT NULL,
	"aceptable" numeric(14, 2),
	"moneda" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objetivos_cohorte_area_metrica_uq" UNIQUE NULLS NOT DISTINCT("cohort_id","area","metrica"),
	CONSTRAINT "objetivos_area_chk" CHECK ("objetivos"."area" is null or "objetivos"."area" in ('paid', 'organico', 'referidos')),
	CONSTRAINT "objetivos_meta_chk" CHECK ("objetivos"."meta" >= 0),
	CONSTRAINT "objetivos_aceptable_chk" CHECK ("objetivos"."aceptable" is null or "objetivos"."aceptable" >= 0),
	CONSTRAINT "objetivos_moneda_chk" CHECK ("objetivos"."moneda" is null or "objetivos"."moneda" in ('COP', 'USD')),
	CONSTRAINT "objetivos_moneda_de_costo_chk" CHECK (("objetivos"."metrica" in ('costo_por_agenda', 'costo_por_lead', 'costo_por_venta')) = ("objetivos"."moneda" is not null))
);
--> statement-breakpoint
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objetivos" ENABLE ROW LEVEL SECURITY;