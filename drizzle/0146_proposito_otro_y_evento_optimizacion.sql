ALTER TYPE "public"."proposito_campana" ADD VALUE 'otro';--> statement-breakpoint
ALTER TABLE "pauta_objetos" ADD COLUMN "evento_optimizacion" text;--> statement-breakpoint
ALTER TABLE "pauta_objetos" ADD CONSTRAINT "pauta_objetos_evento_optimizacion_conjunto_chk" CHECK ("pauta_objetos"."evento_optimizacion" is null or "pauta_objetos"."nivel" = 'conjunto');