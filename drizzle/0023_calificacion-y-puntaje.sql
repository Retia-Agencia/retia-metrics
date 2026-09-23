CREATE TYPE "public"."calificacion_envio" AS ENUM('incompleto', 'sin_recursos', 'con_agenda', 'setteo');--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "calificacion" "calificacion_envio";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "puntaje" integer;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "calificacion" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "calificacion" "calificacion_envio";--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "puntaje" integer;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "version_puntaje" integer;