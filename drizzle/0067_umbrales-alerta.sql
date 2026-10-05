-- Ticket 147: umbrales de las alertas por persistencia. Solo agrega; el FK toma un candado breve sobre programs.
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."metrica_con_umbral" AS ENUM('meta_mes', 'meta_cohorte');--> statement-breakpoint
CREATE TABLE "umbrales_alerta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"metrica" "metrica_con_umbral" NOT NULL,
	"aceptable" numeric(5, 2) NOT NULL,
	"dias_seguidos" integer DEFAULT 5 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "umbrales_alerta_aceptable_check" CHECK ("umbrales_alerta"."aceptable" > 0 AND "umbrales_alerta"."aceptable" <= 100),
	CONSTRAINT "umbrales_alerta_dias_check" CHECK ("umbrales_alerta"."dias_seguidos" BETWEEN 1 AND 30)
);
--> statement-breakpoint
ALTER TABLE "umbrales_alerta" ADD CONSTRAINT "umbrales_alerta_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "umbrales_alerta_programa_metrica_idx" ON "umbrales_alerta" USING btree ("program_id","metrica");