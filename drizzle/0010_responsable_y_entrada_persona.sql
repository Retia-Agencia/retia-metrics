CREATE TYPE "public"."entrada_persona" AS ENUM('formulario', 'crm');--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "responsable_closer_id" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "entrada" "entrada_persona" DEFAULT 'formulario' NOT NULL;