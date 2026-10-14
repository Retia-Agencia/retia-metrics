SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."estado_archivo" AS ENUM('pendiente', 'listo');--> statement-breakpoint
CREATE TABLE "archivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"ruta" text NOT NULL,
	"tipo_mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text,
	"estado" "estado_archivo" DEFAULT 'pendiente' NOT NULL,
	"subido_por_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmado_en" timestamp with time zone,
	"drive_file_id" text,
	"respaldado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "comprobante_archivo_id" uuid;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_subido_por_user_id_users_id_fk" FOREIGN KEY ("subido_por_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "archivos_ruta_idx" ON "archivos" USING btree ("ruta");--> statement-breakpoint
CREATE INDEX "archivos_estado_created_at_idx" ON "archivos" USING btree ("estado","created_at");--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_comprobante_archivo_id_archivos_id_fk" FOREIGN KEY ("comprobante_archivo_id") REFERENCES "public"."archivos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "abonos_comprobante_archivo_idx" ON "abonos" USING btree ("comprobante_archivo_id") WHERE "abonos"."comprobante_archivo_id" is not null;