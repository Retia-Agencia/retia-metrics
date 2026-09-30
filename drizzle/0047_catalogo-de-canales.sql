CREATE TYPE "public"."formato_utm" AS ENUM('plantilla_pauta', 'meta_historico', 'closer');--> statement-breakpoint
CREATE TABLE "canales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"utm_source" text,
	"utm_medium" text NOT NULL,
	"area_id" uuid NOT NULL,
	"formato" "formato_utm",
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "canales" ADD CONSTRAINT "canales_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "canales_par_idx" ON "canales" USING btree (coalesce(lower(trim("utm_source")), ''),lower(trim("utm_medium")));