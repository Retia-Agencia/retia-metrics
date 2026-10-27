SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."proposito_campana" AS ENUM('agenda', 'lanzamiento');--> statement-breakpoint
ALTER TYPE "public"."origen_cambio" ADD VALUE 'whatsapp';--> statement-breakpoint
ALTER TABLE "pauta_objetos" ADD COLUMN "proposito" "proposito_campana";--> statement-breakpoint
ALTER TABLE "pauta_objetos" ADD CONSTRAINT "pauta_objetos_proposito_campana_chk" CHECK ("pauta_objetos"."proposito" is null or "pauta_objetos"."nivel" = 'campana');