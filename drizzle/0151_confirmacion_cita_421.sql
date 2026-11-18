SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."confirmacion_cita" AS ENUM('confirmada', 'no_confirmada', 'cancelada_segun_closer');--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "confirmacion" "confirmacion_cita";--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "confirmacion_en" timestamp with time zone;
